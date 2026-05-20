// ── WhatsApp webhook (Evolution API) ───────────────────────────
// Architecture: AI-first
//   - The AI generates ALL patient-facing responses
//   - The rule-based engine only tracks conversation state
//   - Real data (specialties, professionals, availability) is
//     fetched from Supabase and injected into the AI context
//   - Rule-based responses are fallback ONLY (AI unavailable)

import { NextRequest, NextResponse } from 'next/server'
import type { EvolutionWebhookPayload, EvolutionMessageData, BotContext } from '@/lib/types/whatsapp.types'
import { extractPhone, extractText } from '@/lib/bot/intent-classifier'
import { processMessage, createInitialContext } from '@/lib/bot/conversation-engine'
import { sendMultiple } from '@/lib/bot/evolution-client'
import { createServiceClient } from '@/lib/supabase/service'
import { generateAiResponse } from '@/lib/bot/ai-chat'
import type { AiContext } from '@/lib/bot/ai-chat'

// ── In-memory context cache ────────────────────────────────────

const ctxMap = new Map<string, BotContext>()

async function loadContext(phone: string): Promise<BotContext | null> {
  // Always check Supabase first to survive server restarts / hot reload
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('wa_conversations')
      .select('context')
      .eq('phone', phone)
      .maybeSingle()
    if (data?.context) {
      const ctx = data.context as BotContext
      // Sanitize: detect corrupted patientName (set from "quiero sacar un turno" etc.)
      if (ctx.patientName) {
        const nameLower = ctx.patientName.toLowerCase()
        const garbageWords = ['turno', 'sacar', 'reservar', 'quiero', 'necesito', 'agendar']
        if (garbageWords.some(w => nameLower.includes(w))) {
          console.log('[Bot] Sanitized corrupted patientName:', ctx.patientName)
          ctx.patientName = null
          ctx.isKnownPatient = false
          ctx.state = 'idle'
        }
      }
      ctxMap.set(phone, ctx)
      return ctx
    }
  } catch { /* table may not exist yet */ }
  // Fall back to memory cache
  if (ctxMap.has(phone)) return ctxMap.get(phone)!
  return null
}

async function saveContext(phone: string, name: string | undefined, ctx: BotContext) {
  ctxMap.set(phone, ctx)
  // Persist to Supabase synchronously so context survives server restarts
  try {
    const sb = createServiceClient()
    await sb.from('wa_conversations').upsert(
      { phone, name: name ?? null, bot_state: ctx.state, context: ctx, last_msg_at: new Date().toISOString() },
      { onConflict: 'phone' }
    )
  } catch { /* non-critical */ }
}

async function getConvId(phone: string): Promise<string | null> {
  try {
    const sb = createServiceClient()
    const { data } = await sb.from('wa_conversations').select('id').eq('phone', phone).maybeSingle()
    return data?.id ?? null
  } catch { return null }
}

async function saveMessage(convId: string, direction: 'inbound' | 'outbound', content: string) {
  const sb = createServiceClient()
  await sb.from('wa_messages').insert({ conversation_id: convId, direction, content })
}

// ── Data fetchers (real DB, no hardcoded fallbacks) ─────────────

// Strip accents for comparison (e.g., "Kinesiología" → "Kinesiologia")
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function formatDateKey(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// ── Specialty-professional mapping (JS-side join — no Supabase embedded joins) ─

async function getSpecialtyMap(): Promise<Map<string, string>> {
  const sb = createServiceClient()
  const { data: specs } = await sb.from('specialties').select('id, name')
  const map = new Map<string, string>()
  for (const s of (specs ?? [])) map.set(s.id, s.name)
  return map
}

async function fetchProfessionals(orgId?: string): Promise<string[]> {
  const sb = createServiceClient()
  let q = sb.from('professionals').select('full_name, specialty_id, organization_id').eq('is_active', true).order('full_name')
  if (orgId) q = q.eq('organization_id', orgId)
  const [{ data: profs }, specMap] = await Promise.all([q, getSpecialtyMap()])
  const seen = new Set<string>()
  const result: string[] = []
  for (const p of (profs ?? [])) {
    const specName = specMap.get(p.specialty_id) ?? ''
    const label = specName ? `${p.full_name} (${specName})` : (p.full_name as string)
    if (!seen.has(label)) { seen.add(label); result.push(label) }
  }
  return result
}

async function fetchProfessionalsForSpecialty(specialtyName: string, orgId?: string): Promise<string[]> {
  const sb = createServiceClient()
  const specMap = await getSpecialtyMap()
  const normalizedSearch = normalize(specialtyName.toLowerCase())
  const matchingIds: string[] = []
  for (const [id, name] of specMap) {
    if (normalize(name.toLowerCase()) === normalizedSearch) matchingIds.push(id)
  }
  if (matchingIds.length === 0) return []
  let q = sb.from('professionals')
    .select('full_name').eq('is_active', true).in('specialty_id', matchingIds).order('full_name')
  if (orgId) q = q.eq('organization_id', orgId)
  const { data: profs } = await q
  return (profs ?? []).map((p: { full_name: string }) => `${p.full_name} (${specialtyName})`)
}

async function fetchSpecialtyForProfessional(professionalName: string): Promise<string | null> {
  const stripped = professionalName.replace(/\s*\(.*\)\s*$/, '').replace(/^Dra?\.\s*/i, '')
  const sb = createServiceClient()
  const [{ data: prof }, specMap] = await Promise.all([
    sb.from('professionals').select('specialty_id').ilike('full_name', `%${stripped}%`).limit(1).maybeSingle(),
    getSpecialtyMap(),
  ])
  return prof ? (specMap.get(prof.specialty_id) ?? null) : null
}

async function fetchSpecialties(orgId?: string): Promise<string[]> {
  const sb = createServiceClient()
  let q = sb.from('professionals').select('specialty_id').eq('is_active', true)
  if (orgId) q = q.eq('organization_id', orgId)
  const [{ data: profs }, specMap] = await Promise.all([q, getSpecialtyMap()])
  const seen = new Set<string>()
  const result: string[] = []
  for (const p of (profs ?? [])) {
    const name = specMap.get(p.specialty_id)
    if (name && !seen.has(name)) { seen.add(name); result.push(name) }
  }
  result.sort()
  return result
}

async function getProfessionalId(name: string, orgId?: string): Promise<string | null> {
  const sb = createServiceClient()
  const stripped = name.replace(/\s*\(.*\)\s*$/, '').replace(/^Dra?\.\s*/i, '').trim()
  let query = sb.from('professionals').select('id').ilike('full_name', `%${stripped}%`).limit(1)
  const { data } = await query.maybeSingle()
  return data?.id ?? null
}

async function getScheduleForProfessional(professionalId: string, dateKey?: string): Promise<{
  templates: Array<{ day_of_week: number; start_time: string; end_time: string; slot_duration: number }>
  weeklyInfo: string
  daySlots: Record<number, Array<{ areaName: string | null; duration: number }>>
}> {
  const sb = createServiceClient()

  let query = sb
    .from('weekly_schedules')
    .select('schedule')
    .eq('professional_id', professionalId)

  // Si tenemos fecha, buscamos la semana exacta. Si no, tomamos la más reciente.
  if (dateKey) {
    const weekStart = getWeekStartDate(dateKey)
    query = query.eq('week_start_date', weekStart)
  } else {
    query = query.order('week_start_date', { ascending: false }).limit(1)
  }

  const { data } = await query.maybeSingle()

  const schedule = (data?.schedule ?? {}) as Record<string, { is_working?: boolean; start_time?: string; end_time?: string; slot_duration?: number; slots?: Array<{ area_id?: string; duration: number }> }>
  const templates: Array<{ day_of_week: number; start_time: string; end_time: string; slot_duration: number }> = []
  const daySlots: Record<number, Array<{ areaName: string | null; duration: number }>> = {}
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const weeklyParts: string[] = []

  const areaIds = new Set<string>()
  for (const [, day] of Object.entries(schedule)) {
    for (const s of (day.slots ?? [])) { if (s.area_id) areaIds.add(s.area_id) }
  }
  let areaMap: Record<string, string> = {}
  if (areaIds.size > 0) {
    const { data: areas } = await sb.from('service_areas')
      .select('id, name')
      .in('id', Array.from(areaIds))
    for (const a of (areas ?? [])) areaMap[a.id] = a.name
  }

  for (const [key, day] of Object.entries(schedule)) {
    if (!day.is_working || !day.start_time || !day.end_time) continue
    const dow = parseInt(key)
    templates.push({
      day_of_week: dow,
      start_time: day.start_time,
      end_time: day.end_time,
      slot_duration: day.slot_duration || 30,
    })
    weeklyParts.push(`${dayNames[dow]} ${day.start_time.slice(0, 5)}-${day.end_time.slice(0, 5)}`)

    if ((day.slots ?? []).length > 0) {
      daySlots[dow] = (day.slots ?? []).map(s => ({
        areaName: s.area_id ? (areaMap[s.area_id] ?? null) : null,
        duration: s.duration || 30,
      }))
    }
  }

  if (templates.length === 0) {
    const { data: legacy } = await sb
      .from('availability_templates')
      .select('day_of_week, start_time, end_time, slot_duration')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
    for (const t of (legacy ?? [])) {
      templates.push(t)
      weeklyParts.push(`${dayNames[t.day_of_week]} ${t.start_time.slice(0, 5)}-${t.end_time.slice(0, 5)}`)
    }
  }

  return { templates, weeklyInfo: weeklyParts.join(', ') || 'Sin horarios cargados', daySlots }
}

function generateSlotsFromTemplates(
  templates: Array<{ start_time: string; end_time: string; slot_duration: number }>,
  dateStr: string,
  takenSlots: Set<string>,
  maxResults: number,
  daySlots?: Array<{ areaName: string | null; duration: number }> | null
): Array<{ date: string; time: string; label: string; duration: number }> {
  const result: Array<{ date: string; time: string; label: string; duration: number }> = []

  if (daySlots && daySlots.length > 0) {
    // Use per-slot definitions from the schedule (respects area assignments and varying durations)
    const [sh, sm] = templates[0]?.start_time?.split(':').map(Number) ?? [8, 0]
    let cursorMin = sh * 60 + sm
    let slotIdx = 0

    while (slotIdx < daySlots.length) {
      const slot = daySlots[slotIdx]
      const totalMin = cursorMin + slot.duration
      const hh = String(Math.floor(cursorMin / 60)).padStart(2, '0')
      const mm = String(cursorMin % 60).padStart(2, '0')
      const time = `${hh}:${mm}`

      if (!takenSlots.has(`${dateStr}|${time}`)) {
        const areaSuffix = slot.areaName ? ` — ${slot.areaName} (${slot.duration} min)` : ''
        result.push({ date: dateStr, time, duration: slot.duration, label: `a las ${time}${areaSuffix}` })
        if (maxResults > 0 && result.length >= maxResults) break
      }
      cursorMin += slot.duration
      slotIdx++
    }
  } else {
    // Fallback: generate uniform slots within the time block
    for (const tmpl of templates) {
      const [sh, sm] = tmpl.start_time.split(':').map(Number)
      const [eh, em] = tmpl.end_time.split(':').map(Number)
      const startMin = sh * 60 + sm
      const endMin = eh * 60 + em
      const step = tmpl.slot_duration || 30

      for (let min = startMin; min + step <= endMin; min += step) {
        const hh = String(Math.floor(min / 60)).padStart(2, '0')
        const mm = String(min % 60).padStart(2, '0')
        const time = `${hh}:${mm}`
        if (!takenSlots.has(`${dateStr}|${time}`)) {
          result.push({ date: dateStr, time, duration: step, label: `a las ${time}` })
          if (maxResults > 0 && result.length >= maxResults) break
        }
      }
      if (maxResults > 0 && result.length >= maxResults) break
    }
  }
  return result
}

// Convert JavaScript getDay() (0=Sun,1=Mon,…,6=Sat) to UI format (0=Lun,1=Mar,…,6=Dom)
function toUiDow(jsDow: number): number {
  return jsDow === 0 ? 6 : jsDow - 1
}

async function getSlotsForDate(
  dayOfWeek: number,       // JavaScript getDay() format
  dateKey: string,
  professionalName: string | null,
  maxSlots = 9,
  orgId?: string
): Promise<Array<{ date: string; time: string; label: string; duration: number }>> {
  const sb = createServiceClient()
  const [dd, mm, yy] = dateKey.split('/').map(Number)
  const startISO = new Date(yy, mm - 1, dd, 0, 0).toISOString()
  const endISO   = new Date(yy, mm - 1, dd, 23, 59).toISOString()
  const uiDow    = toUiDow(dayOfWeek)  // UI format for matching schedule keys
  const dayName  = DAY_NAMES[dayOfWeek]

  let professionalIds: string[] = []

  if (professionalName && professionalName !== 'Sin preferencia') {
    const pid = await getProfessionalId(professionalName, orgId)
    if (pid) professionalIds = [pid]
  } else {
    let q = sb.from('professionals').select('id').eq('is_active', true)
    if (orgId) q = q.eq('organization_id', orgId)
    const { data: all } = await q
    professionalIds = (all ?? []).map((p: { id: string }) => p.id)
  }

  let allSlots: Array<{ date: string; time: string; label: string; duration: number }> = []

  for (const pid of professionalIds) {
    // ← CAMBIO CLAVE: pasamos dateKey para buscar la semana correcta
    const { templates, daySlots } = await getScheduleForProfessional(pid, dateKey)
    const dayTemplates = templates.filter(t => t.day_of_week === uiDow)

    if (dayTemplates.length === 0) continue

    let query = sb.from('appointments').select('starts_at').gte('starts_at', startISO).lte('starts_at', endISO).not('status', 'eq', 'cancelled')
    const { data: taken } = await query.eq('professional_id', pid)

    const takenSet = new Set<string>()
    for (const a of (taken ?? [])) {
      const d2 = new Date(a.starts_at)
      const tKey = `${String(d2.getHours()).padStart(2, '0')}:${String(d2.getMinutes()).padStart(2, '0')}`
      takenSet.add(`${dateKey}|${tKey}`)
    }

    const slots = generateSlotsFromTemplates(dayTemplates, dateKey, takenSet, maxSlots, daySlots?.[uiDow] ?? null)
      .map(s => ({ ...s, label: `${dayName} ${dd}/${mm} ${s.label}` }))
    allSlots = [...allSlots, ...slots]
  }

  return allSlots.slice(0, maxSlots)
}

async function fetchAvailableDates(professionalName: string | null, orgId?: string): Promise<Array<{ date: string; label: string; slots: Array<{ time: string; area: string | null; duration: number }> }>> {
  const today = new Date()
  const candidateDates: string[] = []
  for (let i = 0; i <= 21; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    candidateDates.push(formatDateKey(d))
    if (candidateDates.length >= 14) break
  }

  const foundDates: Array<{ date: string; label: string; slots: Array<{ time: string; area: string | null; duration: number }> }> = []

  for (const dateKey of candidateDates) {
    const [dd, mm, yy] = dateKey.split('/').map(Number)
    const dow = new Date(yy, mm - 1, dd, 12).getDay()
    const daySlots = await getSlotsForDate(dow, dateKey, professionalName, 9, orgId)
    console.log(`[Availability] ${professionalName} | ${dateKey} (dow=${dow}) | slots: ${daySlots.length}`)
    if (daySlots.length > 0) {
      const dayName = DAY_NAMES[dow]
      // Extract area name from slot label (format: "a las 10:30 — Limpieza (20 min)" or "a las 10:30")
      const slots = daySlots.map(s => {
        const areaMatch = s.label.match(/— (.+?) \(\d+ min\)$/)
        return { time: s.time, area: areaMatch?.[1] ?? null, duration: s.duration }
      })
      foundDates.push({ date: dateKey, label: `${dayName} ${dd}/${mm}`, slots })
      if (foundDates.length >= 14) break
    }
  }
  return foundDates
}

async function fetchAvailableSlots(dateKey: string, professionalName: string | null, orgId?: string): Promise<{ date: string; time: string; label: string }[]> {
  const [dd, mm, yy] = dateKey.split('/').map(Number)
  const dow = new Date(yy, mm - 1, dd, 12).getDay()
  const slots = await getSlotsForDate(dow, dateKey, professionalName, 9, orgId)
  return slots.map(s => ({
    date: s.date,
    time: s.time,
    label: s.label,
  }))
}

// Pre-fetch available dates AND slots for ALL active professionals (summary for AI)
async function fetchAllAvailability(orgId?: string): Promise<Record<string, string[]>> {
  const allProfs = await fetchProfessionals(orgId)
  const result: Record<string, string[]> = {}

  for (const profLabel of allProfs) {
    try {
      const dates = await fetchAvailableDates(profLabel, orgId)
      if (dates.length > 0) {
        // Format each day's availability. Two cases for ANY professional:
        // Caso 1: at least one slot has area → group by area, filter nulls
        //   "Vie 29/5 → Extraccion: 08:00 | Implantes: 09:00"
        // Caso 2: ALL slots are "Solo duración" → just list times
        //   "Jue 21/5 → 09:00, 09:30, 10:00"
        const lines: string[] = []
        for (const d of dates) {
          const withArea = d.slots.filter(s => s.area !== null)
          if (withArea.length > 0) {
            // Caso 1: agrupar por área (solo slots con área)
            const byArea = new Map<string, string[]>()
            for (const s of withArea) {
              const area = s.area!
              if (!byArea.has(area)) byArea.set(area, [])
              byArea.get(area)!.push(s.time)
            }
            const areaParts = Array.from(byArea.entries()).map(([area, times]) => `${area}: ${times.join(', ')}`)
            lines.push(`${d.label} → ${areaParts.join(' | ')}`)
          } else {
            // Caso 2: sin áreas, mostrar solo horarios
            const times = d.slots.map(s => s.time)
            lines.push(`${d.label} → ${times.join(', ')}`)
          }
        }
        result[profLabel] = lines
      }
    } catch { /* skip if no schedule */ }
  }
  console.log('[Agent] allAvailability context:', JSON.stringify(result, null, 2))
  return result
}

async function fetchUpcomingAppointments(patientId: string) {
  const sb = createServiceClient()
  const { data } = await sb
    .from('appointments')
    .select('id, starts_at, treatment, professional:professionals(full_name)')
    .eq('patient_id', patientId)
    .not('status', 'eq', 'cancelled')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(5)
  return (data ?? []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    date: new Date(a.starts_at as string).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    time: new Date(a.starts_at as string).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    professional: (a.professional as Record<string, string> | null)?.full_name ?? 'Profesional',
    specialty: (a.treatment as string) ?? 'Consulta',
  }))
}

// ── Appointment persistence ────────────────────────────────────

function parseDateToISO(dateStr: string, timeStr: string, durationMin = 30) {
  const [day, month, year] = dateStr.split('/')
  const iso = `${year}-${(month ?? '01').padStart(2, '0')}-${(day ?? '01').padStart(2, '0')}T${timeStr ?? '09:00'}:00`
  const start = new Date(iso)
  return { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + durationMin * 60_000).toISOString() }
}

async function saveAppointmentFromBot(ctx: BotContext, orgId?: string): Promise<void> {
  if (!ctx.selectedDate || !ctx.selectedTime) {
    console.error('[Bot] Cannot save appointment: missing date or time', { date: ctx.selectedDate, time: ctx.selectedTime })
    return
  }
  if (!orgId) { console.error('[Bot] Cannot save appointment: no orgId') ; return }
  const sb = createServiceClient()

  // Find the clinic for this org
  const { data: clinic } = await sb.from('clinics')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .limit(1).maybeSingle()
  if (!clinic) { console.error('[Bot] No clinic found for org', orgId) ; return }

  const cleanPhone = ctx.phone.replace(/@\w+$/, '')
  let patientId: string

  const { data: existing } = await sb.from('patients')
    .select('id')
    .eq('phone', cleanPhone)
    .eq('organization_id', orgId)
    .maybeSingle()
  const patientName = ctx.patientName?.trim() ?? ''
  const patientParts = patientName.split(/\s+/)
  const firstName = patientParts[0] || 'Paciente'
  const lastName = patientParts.slice(1).join(' ') || 'WhatsApp'
  const patientDni = ctx.pendingDni ?? null
  const patientPhone = cleanPhone

  if (existing) {
    patientId = existing.id
    // Update existing patient with latest data from agent
    await sb.from('patients')
      .update({ first_name: firstName, last_name: lastName, dni: patientDni })
      .eq('id', patientId)
  } else {
    const { data: created } = await sb.from('patients').insert({
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      phone: patientPhone,
      dni: patientDni,
    }).select('id').single()
    if (!created) { console.error('[Bot] Failed to create patient') ; return }
    patientId = created.id
  }

  // Find professional in this org
  let professionalId: string | null = null
  if (ctx.selectedProfessional && ctx.selectedProfessional !== 'Sin preferencia') {
    const stripped = ctx.selectedProfessional.replace(/\s*\(.*\)\s*$/, '').replace(/^Dra?\.\s*/i, '')
    const { data: prof } = await sb.from('professionals')
      .select('id')
      .ilike('full_name', `%${stripped}%`)
      .eq('is_active', true)
      .limit(1).maybeSingle()
    professionalId = prof?.id ?? null
  }
  if (!professionalId) {
    const { data: anyProf } = await sb.from('professionals')
      .select('id')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(1).maybeSingle()
    professionalId = anyProf?.id ?? null
  }
  if (!professionalId) { console.error('[Bot] No professional found for org', orgId) ; return }

  let slotDuration = 30
  if (ctx.selectedDate) {
    const [dd, mm, yy] = ctx.selectedDate.split('/').map(Number)
    const dow = new Date(yy, mm - 1, dd, 12).getDay()
    const { templates } = await getScheduleForProfessional(professionalId, ctx.selectedDate)
    const dayTemplate = templates.find(t => t.day_of_week === toUiDow(dow))
    if (dayTemplate) slotDuration = dayTemplate.slot_duration || 30
  }

  const { starts_at, ends_at } = parseDateToISO(ctx.selectedDate, ctx.selectedTime, slotDuration)
  console.log('[Bot] Saving appointment:', {
    clinic: clinic.id,
    patient: patientId,
    professional: professionalId,
    starts_at,
    ends_at,
    treatment: ctx.selectedSpecialty,
    orgId
  })
  const { error: insertError } = await sb.from('appointments').insert({
    clinic_id: clinic.id,
    patient_id: patientId,
    professional_id: professionalId,
    starts_at, ends_at,
    treatment: ctx.selectedSpecialty ?? 'Consulta',
    status: 'confirmed',
    source: 'whatsapp',
    notes: null, cancellation_reason: null, reminder_sent: false, nps_sent: false, google_event_id: null,
  })
  if (insertError) {
    console.error('[Bot] Failed to insert appointment:', insertError)
  } else {
    console.log('[Bot] Appointment saved successfully')
  }
}

async function cancelAppointmentFromBot(ctx: BotContext): Promise<void> {
  if (!ctx.selectedAppointmentId) return
  const sb = createServiceClient()
  await sb.from('appointments').update({ status: 'cancelled', cancellation_reason: 'Cancelado por paciente via WhatsApp' }).eq('id', ctx.selectedAppointmentId)
}

async function registerNewPatient(ctx: BotContext, phone: string, orgId?: string): Promise<string | null> {
  if (!orgId) { console.error('[Bot] Cannot register patient: no orgId') ; return null }
  const sb = createServiceClient()
  const parts = (ctx.patientName ?? 'Paciente').trim().split(/\s+/)
  const cleanPhone = phone.replace(/@\w+$/, '')
  const { data: patient } = await sb.from('patients').upsert({
    organization_id: orgId,
    first_name: parts[0] ?? 'Paciente',
    last_name: parts.slice(1).join(' ') || 'WhatsApp',
    phone: cleanPhone,
    dni: ctx.pendingDni ?? null,
  }, { onConflict: 'phone' }).select('id').single()
  return patient ? (patient as Record<string, string>).id : null
}


function getWeekStartDate(dateKey: string): string {
  const [dd, mm, yy] = dateKey.split('/').map(Number)
  const date = new Date(yy, mm - 1, dd, 12)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day // lunes como inicio de semana
  date.setDate(date.getDate() + diff)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Fallback responses (used only when AI is unavailable) ──────

const AI_MARKERS = ['__AI_GENERATE__', '__FETCH_DATES__', '__FETCH_SLOTS__']

const FALLBACKS: Record<string, (ctx: BotContext) => string> = {
  identify_patient: () => '¡Hola! 👋 Soy Ana, la secretaria. ¿Me decís tu nombre y apellido? 😊',
  ask_dni: () => '¿Me pasás tu DNI? Solo el número, sin puntos. Si preferís no darlo, decime y seguimos.',
  main_menu: (ctx) => {
    const name = ctx.patientName ?? ''
    return `¡Hola ${name}! 😊 ¿En qué puedo ayudarte hoy?`
  },
  booking_specialty: (ctx) => {
    const specs = ctx.specialties?.join(', ') ?? ''
    return `¿Para qué especialidad necesitás el turno? 😊\n\nTengo: ${specs}`
  },
  booking_professional: (ctx) => {
    const profs = ctx.professionals?.join(', ') ?? ''
    if (!profs) return `¿Con qué profesional querés atenderte?`
    return `Para esa especialidad tengo a: ${profs}\n\n¿Tenés preferencia por alguien? 😊`
  },
  booking_confirm: (ctx) =>
    `¿Confirmás este turno?\n\n${ctx.selectedSpecialty} con ${ctx.selectedProfessional}\n${ctx.selectedDate} a las ${ctx.selectedTime}\n\nRespondé sí o no.`,
  booking_done: (ctx) =>
    `✅ ¡Listo! Te reservé el turno de ${ctx.selectedSpecialty} con ${ctx.selectedProfessional} para el ${ctx.selectedDate} a las ${ctx.selectedTime}.\n\nTe aviso un día antes. ¡Nos vemos! 😊`,
  human_handoff: () =>
    'Dale, ya te conecto con un agente. Un momento...',
  closed: () =>
    '¡Gracias por escribirnos! 😊 Si necesitás algo más, ya sabés.',
}

function getFallbackResponse(ctx: BotContext): string | null {
  const fn = FALLBACKS[ctx.state]
  return fn ? fn(ctx) : null
}

import { checkRateLimit } from '@/lib/utils/rate-limit'

// ── Main webhook handler ──────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit: 30 req/min per IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const rl = checkRateLimit(`webhook:${ip}`, { windowMs: 60_000, maxHits: 30 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const secret = process.env.WEBHOOK_SECRET
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: EvolutionWebhookPayload
  try { payload = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[Webhook] Event:', payload.event, '| Data keys:', Object.keys(payload.data ?? {}))

  const evt = (payload.event as string).toLowerCase()
  if (evt !== 'messages.upsert') {
    return NextResponse.json({ ok: true, skipped: payload.event })
  }

  const data = payload.data as EvolutionMessageData
  if (data.key?.fromMe) return NextResponse.json({ ok: true })

  const jid = data.key?.remoteJid ?? ''
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@c.us') && !jid.endsWith('@lid')) {
    return NextResponse.json({ ok: true })
  }

  const phone = extractPhone(jid)
  const text  = extractText(data as unknown as { message?: Record<string, unknown> })
  const name  = data.pushName

  if (!phone || !text) return NextResponse.json({ ok: true })

  // ── Load context ────────────────────────────────────────────
  let ctx = (await loadContext(phone)) ?? createInitialContext(phone)

  // ── Stale context recovery ──────────────────────────────────
  // If the last message was > 30 min ago, reset any booking/flow
  // state so the bot starts fresh (handles server restarts, long pauses)
  if (ctx.lastMessageAt) {
    const elapsed = Date.now() - new Date(ctx.lastMessageAt).getTime()
    const STALE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
    if (elapsed > STALE_TIMEOUT && ctx.state !== 'idle' && ctx.state !== 'closed') {
      console.log('[Bot] Stale context (' + Math.round(elapsed/60000) + 'm), resetting state:', ctx.state, '→ idle')
      ctx.state = 'idle'
      ctx.selectedSpecialty = null
      ctx.selectedProfessional = null
      ctx.selectedDate = null
      ctx.selectedTime = null
      ctx.selectedAppointmentId = null
      ctx.availableDatesList = undefined
      ctx.availableSlotsList = undefined
    }
  }

  // ── Fetch clinic by WhatsApp instance ─────────────────────────
  // Each Evolution instance is a bot for ONE specific clinic.
  // If the evolution_instance column doesn't exist yet (migration pending),
  // falls back to the first active clinic.
  let orgId: string | undefined
  try {
    const sb = createServiceClient()
    const instanceName = payload.instance
    // Try to find the clinic linked to this Evolution instance
    let clinicData: Record<string, unknown> | null = null
    try {
      const { data } = await sb.from('clinics')
        .select('id, name, organization_id')
        .eq('evolution_instance', instanceName)
        .maybeSingle()
      clinicData = data
      if (clinicData) console.log('[Bot] Found clinic by evolution_instance:', clinicData.name)
    } catch { /* column may not exist yet */ }
    // Fallback: any active clinic (temporary until migration is applied)
    if (!clinicData) {
      const { data } = await sb.from('clinics')
        .select('id, name, organization_id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      clinicData = data
      if (clinicData) console.log('[Bot] Fallback to clinic:', clinicData.name)
      else console.log('[Bot] No active clinic found!')
    }
    if (clinicData?.name) ctx = { ...ctx, clinicName: clinicData.name as string }
    if (clinicData?.organization_id) orgId = clinicData.organization_id as string
    console.log('[Bot] Resolved orgId:', orgId)
  } catch { /* ignore */ }

  // ── Pre-load real data ──────────────────────────────────────
  if (['idle', 'closed', 'greeting'].includes(ctx.state)) {
    const sb = createServiceClient()
    const cleanPhone = phone.replace(/@\w+$/, '')
    let patientQuery = sb.from('patients').select('id, first_name, last_name').eq('phone', cleanPhone)
    if (orgId) patientQuery = patientQuery.eq('organization_id', orgId)
    const { data: patient } = await patientQuery.maybeSingle()
    if (patient) {
      const patientName = `${(patient as Record<string, string>).first_name} ${(patient as Record<string, string>).last_name}`
      const appts = await fetchUpcomingAppointments((patient as Record<string, string>).id)
      ctx = { ...ctx, patientId: (patient as Record<string, string>).id, patientName, isKnownPatient: true, upcomingAppointments: appts }
    }
  }

  if (['main_menu', 'cancel_select', 'reschedule'].includes(ctx.state) && ctx.patientId) {
    ctx = { ...ctx, upcomingAppointments: await fetchUpcomingAppointments(ctx.patientId) }
  }

  // Always refresh specialties & professionals — never cache stale org data
  const specs = await fetchSpecialties(orgId)
  if (specs.length > 0) ctx = { ...ctx, specialties: specs }
  else ctx = { ...ctx, specialties: undefined }

  const profs = await fetchProfessionals(orgId)
  if (profs.length > 0) ctx = { ...ctx, professionals: profs }
  else ctx = { ...ctx, professionals: undefined }

  // ── Process through state machine ───────────────────────────
  const { newContext, responses, shouldEndSession } = processMessage(text, ctx, name)

  // ── Handle data-fetch markers ───────────────────────────────
  let finalResponses = [...responses]
  let aiContext = newContext

  // __FETCH_DATES__ → fetch available dates, then AI generates response
  if (responses.includes('__FETCH_DATES__')) {
    if (newContext.selectedProfessional === 'Sin preferencia' && !newContext.professionals?.length) {
      const profs = await fetchProfessionals(orgId)
      if (profs.length > 0) newContext.selectedProfessional = profs[Math.floor(Math.random() * profs.length)]
    }
    const dates = await fetchAvailableDates(newContext.selectedProfessional, orgId)
    if (dates.length === 0) {
      // No availability — DON'T reset to main_menu. Stay in current state
      // so the AI can respond naturally: "Por ahora no tengo horarios 😕"
      console.log('[Bot] No dates for professional:', newContext.selectedProfessional)
      newContext.availableDatesList = []
      aiContext = newContext
      finalResponses = ['__AI_GENERATE__']
    } else {
      newContext.state = 'booking_date'
      newContext.availableDatesList = dates
      aiContext = newContext
      finalResponses = ['__AI_GENERATE__']
    }
  }

  // __FETCH_SLOTS__ → fetch slots, then AI generates response
  if (responses.includes('__FETCH_SLOTS__')) {
    const slots = await fetchAvailableSlots(newContext.selectedDate!, newContext.selectedProfessional, orgId)
    if (slots.length === 0) {
      // No slots → go back to date selection
      const dates = await fetchAvailableDates(newContext.selectedProfessional, orgId)
      if (dates.length === 0) {
        newContext.state = 'main_menu'
        aiContext = newContext
        finalResponses = ['__AI_GENERATE__']
      } else {
        newContext.state = 'booking_date'
        newContext.availableDatesList = dates
        aiContext = newContext
        finalResponses = ['__AI_GENERATE__']
      }
    } else {
      newContext.availableSlotsList = slots
      aiContext = newContext
      finalResponses = ['__AI_GENERATE__']
    }
  }

  // ── AI-Generated Response (primary) ─────────────────────────
  let aiText: string | null = null
  if (finalResponses.includes('__AI_GENERATE__') || finalResponses.every(r => AI_MARKERS.includes(r))) {
    // Fetch professional schedule and areas for accurate AI descriptions
    let professionalSchedule: string | null = null
    let professionalAreas: string | null = null
    if (aiContext.selectedProfessional && aiContext.selectedProfessional !== 'Sin preferencia') {
      try {
        const pid = await getProfessionalId(aiContext.selectedProfessional, orgId)
        if (pid) {
          const svc = createServiceClient()
          const [{ weeklyInfo }, { data: areasList }] = await Promise.all([
            getScheduleForProfessional(pid),
            svc.from('service_areas').select('name, duration_min').eq('professional_id', pid).eq('is_active', true).order('name'),
          ])
          professionalSchedule = weeklyInfo
          const areas = areasList as Array<{ name: string; duration_min: number }> | null
          if (areas && areas.length > 0) {
            professionalAreas = areas.map((a: { name: string; duration_min: number }) => `${a.name} (${a.duration_min} min)`).join(', ')
          }
        }
      } catch { /* ignore */ }
    }

    // Save the FULL professionals list (before any filtering) for the
    // specialty→professionals mapping so the AI can answer questions like
    // "¿quién atiende en Cirugía?" even when browsing a different specialty.
    const allProfessionals = aiContext.professionals ?? []

    // Filter professionals by selected specialty so the AI only offers relevant ones
    let professionalsForAi = [...allProfessionals]
    if (aiContext.selectedSpecialty && aiContext.state === 'booking_professional') {
      const filtered = await fetchProfessionalsForSpecialty(aiContext.selectedSpecialty, orgId)
      if (filtered.length > 0) {
        professionalsForAi = filtered
      }
      // If only ONE professional, auto-select and move to date selection
      if (filtered.length === 1) {
        aiContext.selectedProfessional = filtered[0]
        // Fetch available dates for this professional
        const dates = await fetchAvailableDates(filtered[0], orgId)
        if (dates.length > 0) {
          aiContext.state = 'booking_date'
          aiContext.availableDatesList = dates
        } else {
          // No dates for this professional — DON'T advance state
          // Stay in booking_professional so the AI can handle it naturally
          console.log('[Bot] No dates for single professional', filtered[0])
        }
      }
    }

    // Build FULL specialty→professionals mapping from ALL professionals
    // (not just the filtered ones) so the AI can answer any specialty question
    const professionalsBySpecialty: Record<string, string[]> = {}
    for (const prof of allProfessionals) {
      const match = prof.match(/^(.+?)\s*\((.+)\)$/)
      if (match) {
        const profName = match[1].trim()
        const specName = match[2].trim()
        if (!professionalsBySpecialty[specName]) professionalsBySpecialty[specName] = []
        if (!professionalsBySpecialty[specName].includes(profName)) {
          professionalsBySpecialty[specName].push(profName)
        }
      }
    }

    // Pre-fetch ALL availability for ALL professionals so the AI
    // always has real data to answer naturally.
    const allAvailability = await fetchAllAvailability(orgId)

    // Build AI context — ALWAYS include all data. The AI is smart enough
    // to use only what's relevant. No state-based hiding.
    const aiReq: AiContext = {
      patientName: aiContext.patientName,
      clinicName: aiContext.clinicName,
      isKnownPatient: aiContext.isKnownPatient,
      state: aiContext.state,
      selectedSpecialty: aiContext.selectedSpecialty,
      selectedProfessional: aiContext.selectedProfessional,
      selectedDate: aiContext.selectedDate,
      selectedTime: aiContext.selectedTime,
      specialties: aiContext.specialties ?? [],
      professionals: professionalsForAi,
      professionalsBySpecialty,
      availableSlots: aiContext.state === 'booking_slots' || aiContext.state === 'booking_confirm' ? aiContext.availableSlotsList : null,
      availableDates: aiContext.state === 'booking_date' || aiContext.state === 'booking_slots' || aiContext.state === 'booking_confirm' ? aiContext.availableDatesList : null,
      upcomingAppointments: aiContext.upcomingAppointments,
      professionalSchedule,
      professionalAreas,
      allAvailability,
      history: ctx.history ?? [],
    }

    console.log('[Agent] Context — allAvailability:', JSON.stringify(allAvailability))
    console.log('[Agent] Calling AI with orgId:', orgId)
    const agentRes = await generateAiResponse(text, aiReq, orgId)

    if (agentRes) {
      aiText = agentRes.message
      console.log('[Agent] Response OK. Action:', agentRes.action?.type ?? 'none')

      // ── Execute agent action (with backend validation) ──────────
      if (agentRes.action) {
        const a = agentRes.action
        if (a.type === 'book') {
          // Validate and execute booking
          if (a.date && a.time && a.professional && a.specialty) {
            // Validate patientName (at least 2 words) and patientDni (7-8 digits)
            const nameValid = a.patientName && typeof a.patientName === 'string' && a.patientName.trim().split(/\s+/).length >= 2
            const dniValid = a.patientDni && typeof a.patientDni === 'string' && /^\d{7,8}$/.test(a.patientDni.trim())
            if (!nameValid || !dniValid) {
              console.log('[Agent] Book rejected — invalid patient data:', { name: a.patientName, dni: a.patientDni })
              aiText = 'Antes de confirmar, ¿me decís tu nombre completo y DNI? 😊'
            } else {
              console.log('[Agent] Full action JSON:', JSON.stringify(a))
              const bookCtx = { ...newContext,
                selectedDate: a.date,
                selectedTime: a.time,
                selectedProfessional: a.professional,
                selectedSpecialty: a.specialty,
                selectedAppointmentId: null,
                patientName: a.patientName ?? null,
                pendingDni: a.patientDni ?? null,
              }
              try {
                await saveAppointmentFromBot(bookCtx, orgId)
                newContext.state = 'booking_done'
              } catch (err) { console.error('[Agent] Book error:', err) }
            }
          } else {
            console.error('[Agent] Incomplete book action:', a)
          }
        } else if (a.type === 'cancel') {
          const idsToCancel: string[] = a.appointmentIds ?? (a.appointmentId ? [a.appointmentId] : [])
          if (idsToCancel.length > 0) {
            for (const id of idsToCancel) {
              const cancelCtx = { ...newContext, selectedAppointmentId: id }
              try {
                await cancelAppointmentFromBot(cancelCtx)
              } catch (err) { console.error('[Agent] Cancel error for', id, ':', err) }
            }
          }
        }
      }
    } else {
      console.log('[Agent] AI returned null')
    }

    // Fall back to rule-based if AI failed
    if (!aiText) {
      aiText = getFallbackResponse(aiContext)
    }
  }

  // Replace marker responses with AI-generated text
  if (aiText) {
    finalResponses = [aiText]
  } else {
    finalResponses = finalResponses.filter(r => !AI_MARKERS.includes(r))
  }

  // ── Update conversation history ─────────────────────────────
  if (finalResponses.length > 0 && finalResponses[0]) {
    const history = newContext.history ?? []
    history.push({ role: 'user' as const, content: text })
    history.push({ role: 'assistant' as const, content: finalResponses[0] })
    newContext.history = history.slice(-20)
  }

  // ── Persist context ─────────────────────────────────────────
  const finalCtx = shouldEndSession ? { ...newContext, state: 'closed' as const } : newContext
  try { await saveContext(phone, name, finalCtx) } catch (err) { console.error('[Webhook] Save context error:', err) }

  // ── Save messages ───────────────────────────────────────────
  try {
    const convId = await getConvId(phone)
    if (convId) {
      await saveMessage(convId, 'inbound', text)
      for (const r of finalResponses) { if (r) await saveMessage(convId, 'outbound', r) }
    }
  } catch (err) { console.error('[Webhook] Save messages error:', err) }

  // ── Send responses ──────────────────────────────────────────
  const toSend = finalResponses.filter(r => r && !AI_MARKERS.includes(r))
  if (toSend.length > 0) {
    try {
      console.log('[Bot] Sending to', jid, '→', JSON.stringify(toSend.map(r => r.slice(0, 50))))
      await sendMultiple(jid, toSend)
      console.log('[Bot] Sent OK')
    } catch (err) {
      console.error('[Bot] Send error:', String(err))
    }
  }

  return NextResponse.json({ ok: true, state: finalCtx.state, responses: toSend.length })
}

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge)
  return NextResponse.json({ status: 'Bot webhook active' })
}
