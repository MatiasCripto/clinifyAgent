import { NextRequest, NextResponse } from 'next/server'
import type { EvolutionWebhookPayload, EvolutionMessageData, BotContext } from '@/lib/types/whatsapp.types'
import { extractPhone, extractText } from '@/lib/bot/intent-classifier'
import { processMessage, createInitialContext } from '@/lib/bot/conversation-engine'
import { sendMultiple } from '@/lib/bot/evolution-client'
import { createServiceClient } from '@/lib/supabase/service'

// ── Context — Map en memoria (primario) + Supabase (respaldo) ─

const ctxMap = new Map<string, BotContext>()

async function loadContext(phone: string): Promise<BotContext | null> {
  // 1. Intentar desde memoria
  if (ctxMap.has(phone)) return ctxMap.get(phone)!
  // 2. Intentar desde Supabase (si la migración 004 está aplicada)
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('wa_conversations')
      .select('context')
      .eq('phone', phone)
      .maybeSingle()
    if (data?.context) {
      const ctx = data.context as BotContext
      ctxMap.set(phone, ctx)
      return ctx
    }
  } catch { /* tabla no existe aún, ignorar */ }
  return null
}

async function saveContext(phone: string, name: string | undefined, ctx: BotContext) {
  ctxMap.set(phone, ctx)
  // Guardar en Supabase en background (no bloqueante)
  const sb = createServiceClient()
  void sb.from('wa_conversations').upsert(
    { phone, name: name ?? null, bot_state: ctx.state, context: ctx, last_msg_at: new Date().toISOString() },
    { onConflict: 'phone' }
  )
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

// ── Appointment helpers ───────────────────────────────────────

const ALL_TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00']
const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

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

async function fetchProfessionals(): Promise<string[]> {
  const sb = createServiceClient()
  const { data } = await sb.from('professionals').select('full_name').eq('is_active', true).order('full_name')
  return (data ?? []).map((p: { full_name: string }) => p.full_name)
}

async function fetchSpecialties(): Promise<string[]> {
  const sb = createServiceClient()
  const { data } = await sb.from('specialties').select('name').order('name')
  return (data ?? []).map((s: { name: string }) => s.name)
}

async function fetchAvailableDates(professionalName: string | null): Promise<{ date: string; label: string }[]> {
  const sb = createServiceClient()
  const today = new Date()
  const candidateDates: string[] = []
  for (let i = 1; i <= 21; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    if (d.getDay() !== 0) {
      candidateDates.push(d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }))
    }
    if (candidateDates.length >= 14) break
  }

  let professionalId: string | null = null
  if (professionalName && professionalName !== 'Sin preferencia') {
    const stripped = professionalName.replace(/^Dra?\.\s*/i, '')
    const { data: prof } = await sb.from('professionals').select('id').ilike('full_name', `%${stripped}%`).limit(1).maybeSingle()
    professionalId = prof?.id ?? null
  }

  const [fd, fm, fy] = candidateDates[0].split('/')
  const [ld, lm, ly] = candidateDates[candidateDates.length - 1].split('/')
  const startISO = new Date(`${fy}-${fm}-${fd}T00:00:00`).toISOString()
  const endISO   = new Date(`${ly}-${lm}-${ld}T23:59:59`).toISOString()

  let query = sb.from('appointments').select('starts_at').gte('starts_at', startISO).lte('starts_at', endISO).not('status', 'eq', 'cancelled')
  if (professionalId) query = query.eq('professional_id', professionalId)
  const { data: taken } = await query

  const takenSet = new Set((taken ?? []).map((a: { starts_at: string }) => {
    const d = new Date(a.starts_at)
    return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}|${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }))

  const result: { date: string; label: string }[] = []
  for (const date of candidateDates) {
    if (ALL_TIMES.some(t => !takenSet.has(`${date}|${t}`))) {
      const [d, m, y] = date.split('/')
      const dayName = DAY_NAMES[new Date(`${y}-${m}-${d}T12:00:00`).getDay()]
      result.push({ date, label: `${dayName} ${d}/${m}` })
      if (result.length >= 7) break
    }
  }
  return result
}

async function fetchAvailableSlots(dateKey: string, professionalName: string | null): Promise<{ date: string; time: string; label: string }[]> {
  const sb = createServiceClient()
  let professionalId: string | null = null
  if (professionalName && professionalName !== 'Sin preferencia') {
    const stripped = professionalName.replace(/^Dra?\.\s*/i, '')
    const { data: prof } = await sb.from('professionals').select('id').ilike('full_name', `%${stripped}%`).limit(1).maybeSingle()
    professionalId = prof?.id ?? null
  }

  const [d, m, y] = dateKey.split('/')
  const startISO = new Date(`${y}-${m}-${d}T00:00:00`).toISOString()
  const endISO   = new Date(`${y}-${m}-${d}T23:59:59`).toISOString()

  let query = sb.from('appointments').select('starts_at').gte('starts_at', startISO).lte('starts_at', endISO).not('status', 'eq', 'cancelled')
  if (professionalId) query = query.eq('professional_id', professionalId)
  const { data: taken } = await query

  const takenSet = new Set((taken ?? []).map((a: { starts_at: string }) => {
    const d2 = new Date(a.starts_at)
    return `${d2.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}|${d2.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }))

  const [dd, mm, yy] = dateKey.split('/')
  const dayName = DAY_NAMES[new Date(`${yy}-${mm}-${dd}T12:00:00`).getDay()]
  return ALL_TIMES
    .filter(time => !takenSet.has(`${dateKey}|${time}`))
    .slice(0, 9)
    .map((time, i) => ({ date: dateKey, time, label: `${dayName} ${dd}/${mm} a las ${time}` }))
}

function parseDateToISO(dateStr: string, timeStr: string) {
  const [day, month, year] = dateStr.split('/')
  const iso = `${year}-${(month ?? '01').padStart(2, '0')}-${(day ?? '01').padStart(2, '0')}T${timeStr ?? '09:00'}:00`
  const start = new Date(iso)
  return { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 30 * 60_000).toISOString() }
}

async function saveAppointmentFromBot(ctx: BotContext): Promise<void> {
  if (!ctx.selectedDate || !ctx.selectedTime) return
  const sb = createServiceClient()
  const { data: clinic } = await sb.from('clinics').select('id, organization_id').limit(1).maybeSingle()
  if (!clinic) return

  const cleanPhone = ctx.phone.replace(/@\w+$/, '')
  let patientId: string

  const { data: existing } = await sb.from('patients').select('id').eq('phone', cleanPhone).maybeSingle()
  if (existing) {
    patientId = existing.id
  } else {
    const parts = (ctx.patientName ?? 'Paciente').trim().split(/\s+/)
    const { data: created } = await sb.from('patients').insert({
      organization_id: (clinic as Record<string, string>).organization_id,
      first_name: parts[0] ?? 'Paciente',
      last_name: parts.slice(1).join(' ') || 'WhatsApp',
      phone: cleanPhone,
      dni: ctx.pendingDni ?? null,
    }).select('id').single()
    if (!created) return
    patientId = created.id
  }

  let professionalId: string | null = null
  if (ctx.selectedProfessional && ctx.selectedProfessional !== 'Sin preferencia') {
    const stripped = ctx.selectedProfessional.replace(/^Dra?\.\s*/i, '')
    const { data: prof } = await sb.from('professionals').select('id').ilike('full_name', `%${stripped}%`).limit(1).maybeSingle()
    professionalId = prof?.id ?? null
  }
  if (!professionalId) {
    const { data: anyProf } = await sb.from('professionals').select('id').eq('is_active', true).limit(1).maybeSingle()
    professionalId = anyProf?.id ?? null
  }
  if (!professionalId) return

  const { starts_at, ends_at } = parseDateToISO(ctx.selectedDate, ctx.selectedTime)
  await sb.from('appointments').insert({
    clinic_id: (clinic as Record<string, string>).id,
    patient_id: patientId,
    professional_id: professionalId,
    starts_at, ends_at,
    treatment: ctx.selectedSpecialty ?? 'Consulta',
    status: 'confirmed',
    source: 'whatsapp',
    notes: null, cancellation_reason: null, reminder_sent: false, nps_sent: false, google_event_id: null,
  })
}

async function cancelAppointmentFromBot(ctx: BotContext): Promise<void> {
  if (!ctx.selectedAppointmentId) return
  const sb = createServiceClient()
  await sb.from('appointments').update({ status: 'cancelled', cancellation_reason: 'Cancelado por paciente via WhatsApp' }).eq('id', ctx.selectedAppointmentId)
}

async function registerNewPatient(ctx: BotContext, phone: string): Promise<string | null> {
  const sb = createServiceClient()
  const { data: clinic } = await sb.from('clinics').select('organization_id').limit(1).maybeSingle()
  if (!clinic) return null
  const parts = (ctx.patientName ?? 'Paciente').trim().split(/\s+/)
  const cleanPhone = phone.replace(/@\w+$/, '')
  const { data: patient } = await sb.from('patients').upsert({
    organization_id: (clinic as Record<string, string>).organization_id,
    first_name: parts[0] ?? 'Paciente',
    last_name: parts.slice(1).join(' ') || 'WhatsApp',
    phone: cleanPhone,
    dni: ctx.pendingDni ?? null,
  }, { onConflict: 'phone' }).select('id').single()
  return patient ? (patient as Record<string, string>).id : null
}

// ── Main webhook handler ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: EvolutionWebhookPayload
  try { payload = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.event !== 'messages.upsert') return NextResponse.json({ ok: true })

  const data = payload.data as EvolutionMessageData
  if (data.key?.fromMe) return NextResponse.json({ ok: true })

  const jid = data.key?.remoteJid ?? ''
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@c.us') && !jid.endsWith('@lid')) {
    return NextResponse.json({ ok: true })
  }

  // Use remoteJid for replying (Evolution handles @lid routing internally)
  // Use extractPhone(jid) only for DB lookups (clean number without suffix)
  const phone = extractPhone(jid)
  const text  = extractText(data as unknown as { message?: Record<string, unknown> })
  const name  = data.pushName

  if (!phone || !text) return NextResponse.json({ ok: true })

  // ── Cargar contexto desde Supabase ─────────────────────────
  let ctx = (await loadContext(phone)) ?? createInitialContext(phone)

  // ── Fetch clinic name fresh on every message (so renames take effect immediately) ──
  try {
    const sb = createServiceClient()
    const { data: clinic } = await sb.from('clinics').select('name').eq('is_active', true).limit(1).maybeSingle()
    if (clinic?.name) ctx = { ...ctx, clinicName: clinic.name }
  } catch { /* ignore */ }

  // ── Pre-inject DB data ─────────────────────────────────────

  if (['idle', 'closed', 'greeting'].includes(ctx.state)) {
    const sb = createServiceClient()
    const cleanPhone = phone.replace(/@\w+$/, '')
    const { data: patient } = await sb.from('patients').select('id, first_name, last_name').eq('phone', cleanPhone).maybeSingle()
    if (patient) {
      const patientName = `${(patient as Record<string, string>).first_name} ${(patient as Record<string, string>).last_name}`
      const appts = await fetchUpcomingAppointments((patient as Record<string, string>).id)
      ctx = { ...ctx, patientId: (patient as Record<string, string>).id, patientName, isKnownPatient: true, upcomingAppointments: appts }
    }
  }

  if (['main_menu', 'cancel_select', 'reschedule'].includes(ctx.state) && ctx.patientId) {
    ctx = { ...ctx, upcomingAppointments: await fetchUpcomingAppointments(ctx.patientId) }
  }

  if (['idle', 'closed', 'main_menu', 'booking_specialty'].includes(ctx.state) && !ctx.specialties) {
    const specs = await fetchSpecialties()
    if (specs.length > 0) ctx = { ...ctx, specialties: specs }
  }

  if (ctx.state === 'booking_specialty' && !ctx.professionals) {
    const profs = await fetchProfessionals()
    if (profs.length > 0) ctx = { ...ctx, professionals: profs }
  }

  const { newContext, responses, shouldEndSession } = processMessage(text, ctx, name)

  // ── Post-process markers ───────────────────────────────────

  if (newContext.state === 'booking_date' && responses[0] === '__FETCH_DATES__') {
    if (newContext.selectedProfessional === 'Sin preferencia') {
      const profs = await fetchProfessionals()
      if (profs.length > 0) newContext.selectedProfessional = profs[Math.floor(Math.random() * profs.length)]
    }
    const dates = await fetchAvailableDates(newContext.selectedProfessional)
    if (dates.length === 0) {
      newContext.state = 'main_menu'
      responses[0] = `Lo siento, no hay turnos disponibles en los próximos días 😔\n¿Puedo ayudarte con algo más?`
    } else {
      newContext.availableDatesList = dates
      responses[0] = `📅 *¿Para qué fecha querés el turno?*\n\n${dates.map((d, i) => `${i + 1}️⃣ ${d.label}`).join('\n')}\n\nRespondé con el número de la fecha.`
    }
  }

  if (newContext.state === 'booking_slots' && responses[0] === '__FETCH_SLOTS__') {
    const slots = await fetchAvailableSlots(newContext.selectedDate!, newContext.selectedProfessional)
    if (slots.length === 0) {
      const dates = await fetchAvailableDates(newContext.selectedProfessional)
      newContext.state = 'booking_date'
      newContext.availableDatesList = dates.length > 0 ? dates : undefined
      responses[0] = dates.length > 0
        ? `No hay turnos disponibles para ese día 😔\n\n*¿Querés elegir otra fecha?*\n\n${dates.map((d, i) => `${i + 1}️⃣ ${d.label}`).join('\n')}`
        : `No hay turnos disponibles en los próximos días 😔`
    } else {
      newContext.availableSlotsList = slots
      responses[0] = `🕐 *Turnos disponibles:*\n\n${slots.map((s, i) => `${i + 1}️⃣ ${s.label}`).join('\n')}\n\nRespondé con el número del turno.`
    }
  }

  // ── Registrar nuevo paciente cuando completa el onboarding ──
  const justRegistered = ctx.state === 'ask_dni' && newContext.state === 'main_menu' && !newContext.isKnownPatient
  if (justRegistered && newContext.patientName) {
    try {
      const patientId = await registerNewPatient(newContext, phone)
      if (patientId) {
        newContext.patientId = patientId
        newContext.isKnownPatient = true
      }
    } catch (err) {
      console.error('[Bot] Register patient error:', err)
    }
  }

  // ── Transiciones de turno ──────────────────────────────────
  const justBooked      = newContext.state === 'booking_done' && ctx.state !== 'booking_done'
  const justCancelled   = ctx.state === 'cancel_confirm'  && newContext.state === 'main_menu' && !!ctx.selectedAppointmentId
  const justRescheduled = ctx.state === 'reschedule'      && newContext.state === 'booking_specialty' && !!ctx.selectedAppointmentId

  if (justBooked) {
    try { await saveAppointmentFromBot(newContext) } catch (err) { console.error('[Bot] Save appt error:', err) }
  }
  if (justCancelled) {
    try { await cancelAppointmentFromBot(ctx) } catch (err) { console.error('[Bot] Cancel appt error:', err) }
  }
  if (justRescheduled) {
    try {
      await cancelAppointmentFromBot(ctx)
      newContext.selectedAppointmentId = null
      newContext.selectedDate = null
      newContext.selectedTime = null
    } catch (err) { console.error('[Bot] Reschedule error:', err) }
  }

  // ── Guardar contexto en Supabase ───────────────────────────
  const finalCtx = shouldEndSession ? { ...newContext, state: 'closed' as const } : newContext
  try {
    await saveContext(phone, name, finalCtx)
  } catch (err) {
    console.error('[Webhook] Save context error:', err)
  }

  // ── Guardar mensajes ───────────────────────────────────────
  try {
    const convId = await getConvId(phone)
    if (convId) {
      await saveMessage(convId, 'inbound', text)
      for (const r of responses) await saveMessage(convId, 'outbound', r)
    }
  } catch (err) {
    console.error('[Webhook] Save messages error:', err)
  }

  // ── Enviar respuestas (usar jid completo para @lid routing) ──
  if (responses.length > 0) {
    try {
      await sendMultiple(jid, responses)
    } catch (err) {
      console.error('[Bot] Send error:', String(err))
    }
  }

  return NextResponse.json({ ok: true, state: finalCtx.state, responses: responses.length })
}

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge)
  return NextResponse.json({ status: 'Bot webhook active' })
}
