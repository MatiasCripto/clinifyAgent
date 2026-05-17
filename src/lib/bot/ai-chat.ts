// ── Conversational AI engine for WhatsApp bot ──────────────────
// AI-first architecture: the AI generates ALL patient-facing responses.
// The rule-based engine only tracks state — it never talks to patients.
//
// Data flow:
//   DB → context builder → AI system prompt → natural response
//
// The AI NEVER invents data. All specialties, professionals, and
// availability come from the context built by the webhook handler.

import { createServiceClient } from '@/lib/supabase/service'

interface AiConfig {
  provider: string
  apiKey: string
  model: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiContext {
  patientName?: string | null
  clinicName?: string
  isKnownPatient?: boolean
  // Current booking flow state
  state: string
  selectedSpecialty?: string | null
  selectedProfessional?: string | null
  selectedDate?: string | null
  selectedTime?: string | null
  // Real data from DB (never hardcoded fallbacks)
  specialties: string[]
  professionals: string[]
  // Full mapping so the AI can answer "who covers X specialty?"
  professionalsBySpecialty?: Record<string, string[]> | null
  availableSlots?: Array<{ date: string; time: string; label: string }> | null
  availableDates?: Array<{ date: string; label: string }> | null
  upcomingAppointments?: Array<{ id: string; date: string; time: string; professional: string; specialty: string }> | null
  // Professional schedule info for accurate descriptions
  professionalSchedule?: string | null
  // Service areas (e.g., "Masajes (30 min), Descontracturas (45 min)")
  professionalAreas?: string | null
  // Pre-fetched availability for ALL professionals (e.g. {"Denise (Odontologia)": ["Lun 18/05", "Vie 22/05"], ...})
  allAvailability?: Record<string, string[]> | null
  // Conversation memory
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

// ── System Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos Ana, la secretaria de una clínica médica moderna. Atendés por WhatsApp como una persona REAL.

PERSONALIDAD:
- Cálida, eficiente, humana, cercana, profesional
- Mensajes CORTOS (1-3 oraciones). UNA pregunta por vez.
- Emojis leves y naturales: 😊 👍 ✅
- Te adaptás al paciente: si escribe corto → respondés corto; si duda → lo guiás; si está apurado → vas directo
- NO parecés chatbot. Sonás como una secretora de verdad.

PROHIBIDO:
- "Seleccione una opción", "Ingrese sus datos", "Estoy procesando"
- "Asistente virtual", "Menú principal", "Indique el motivo", "Ticket", "Estimado cliente"
- "Respondé con el número", "Opción inválida"
- Listas numeradas (1️⃣ 2️⃣ 3️⃣), bullets o items con emojis
- Interrogatorios, mensajes largos, preguntar datos que el paciente ya dió
- Negritas, markdown o formatos especiales
- Repetir exactamente el mismo mensaje
- Incluir fragmentos del mensaje del paciente en tu respuesta

DATOS — REGLAS OBLIGATORIAS (LEÉ ESTO PRIMERO):
- ⛔ PROHIBIDO INVENTAR DATOS. Todo lo que digas DEBE estar en el CONTEXTO.
- ⛔ NUNCA digas "hoy", "hoy tenemos", "disponible hoy" si availableDates es null o vacío.
- ⛔ NUNCA menciones días específicos (hoy, mañana, lunes) sin datos reales de availableDates.
- ⛔ Si el estado es main_menu o identify_patient: SOLO saludá y preguntá en qué podés ayudar. NO listes profesionales.
- ⛔ Si alguien pregunta "qué especialidades tienen" o "qué profesionales hay", AHÍ SÍ usá los datos del contexto.
- ⛔ NUNCA ofrezcas todos los profesionales de una sin que te pregunten.
- ⛔ Si el contexto dice que hay profesionales para una especialidad, NUNCA digas que no hay.
- ⛔ Si el contexto lista profesionales con nombres reales, usá ESOS nombres.
- ⛔ NUNCA sugieras especialidades que NO aparecen en el contexto.
- ⛔ Si alguien pregunta "quién atiende en X", respondé con los nombres EXACTOS del mapeo.
- El contexto es tu ÚNICA fuente de verdad. Lo que no está en el contexto, NO EXISTE.
- Si el estado es booking_specialty: NO ofrezcas fechas ni horarios — preguntá primero la especialidad.
- Si availableDates está vacío y en estado booking_date: decí que no hay disponibilidad.
- Ofrecé solo alternativas que ESTÉN en el contexto.
- Confirmás antes de reservar.

CAPACIDADES:
- Sacar turnos, cancelarlos y reprogramarlos
- Decir EXACTAMENTE qué profesionales cubren cada especialidad (del mapeo del contexto, PALABRA POR PALABRA)
- Decir qué días y horarios atiende cada profesional (solo si availableDates/availableSlots está presente)
- Si un profesional tiene áreas de atención, las mencionás

FLUJO NATURAL:
- Si es nuevo → saludar y preguntar cómo podés ayudar
- Si ya lo conocés → saludo corto y preguntar qué necesita
- JAMÁS listes profesionales o especialidades en el primer mensaje
- Preguntar especialidad → ofrecer profesionales → consultar disponibilidad → ofrecer horarios (pocos, 3-4 máx) → confirmar → reservar
- Responder preguntas libres de forma natural y volver al objetivo
- Si el paciente pregunta algo fuera de lo que sabés, decile con honestidad

EJEMPLOS DE TONO:
- "Hola 😊 ¿En qué puedo ayudarte?"
- "¿Para qué especialidad necesitás el turno?"
- "Tengo a la Dra. Martínez y al Dr. López. ¿Tenés preferencia?"
- "Perfecto, ¿el martes a las 10:30 te queda bien?"
- "Dale, ya te lo reservo 👍"
- "Por ahora no tengo turnos con ese profesional 😕 ¿Querés que vea con otro?"`

// ── Build conversational context for AI ───────────────────────

export function buildAiPrompt(
  userMessage: string,
  ctx: AiContext
): string {
  const parts: string[] = []

  // Clinic info
  if (ctx.clinicName) {
    parts.push(`Clínica: ${ctx.clinicName}`)
  }

  // Patient info
  if (ctx.patientName) {
    parts.push(`Paciente: ${ctx.patientName}`)
  }
  if (ctx.isKnownPatient) {
    parts.push(`Es paciente registrado en el sistema.`)
  }

  // Current booking state
  if (ctx.selectedSpecialty) {
    parts.push(`Especialidad elegida: ${ctx.selectedSpecialty}`)
  }
  if (ctx.selectedProfessional && ctx.selectedProfessional !== 'Sin preferencia') {
    parts.push(`Profesional elegido: ${ctx.selectedProfessional}`)
  }
  if (ctx.selectedDate) {
    parts.push(`Fecha elegida: ${ctx.selectedDate}`)
  }
  if (ctx.selectedTime) {
    parts.push(`Horario elegido: ${ctx.selectedTime}`)
  }

  // REAL data from DB
  if (ctx.specialties.length > 0) {
    parts.push(`Especialidades disponibles HOY en el sistema: ${ctx.specialties.join(', ')}`)
  }
  if (ctx.professionals.length > 0) {
    parts.push(`Profesionales activos HOY en la clínica: ${ctx.professionals.join(', ')}`)
  }
  if (ctx.professionalsBySpecialty && Object.keys(ctx.professionalsBySpecialty).length > 0) {
    parts.push(`Mapeo completo especialidad → profesionales:`)
    for (const [spec, profs] of Object.entries(ctx.professionalsBySpecialty)) {
      parts.push(`  ${spec}: ${profs.join(', ')}`)
    }
  }
  if (ctx.availableDates && ctx.availableDates.length > 0) {
    parts.push(`Fechas con disponibilidad real: ${ctx.availableDates.map(d => d.label).join(', ')}`)
  }
  if (ctx.availableSlots && ctx.availableSlots.length > 0) {
    parts.push(`Horarios disponibles (usar SOLO estos): ${ctx.availableSlots.map(s => s.label).join(', ')}`)
  }
  if (ctx.professionalSchedule) {
    parts.push(`Horario semanal del profesional elegido: ${ctx.professionalSchedule}`)
  }
  if (ctx.professionalAreas) {
    parts.push(`Áreas de atención del profesional: ${ctx.professionalAreas}`)
  }

  // Pre-fetched availability across all professionals (next 14 days)
  if (ctx.allAvailability && Object.keys(ctx.allAvailability).length > 0) {
    parts.push(`DISPONIBILIDAD REAL (próximos 14 días) — USÁ SOLO ESTOS DATOS:`)
    for (const [prof, dates] of Object.entries(ctx.allAvailability)) {
      parts.push(`  ${prof}: ${dates.join(', ')}`)
    }
    parts.push(`Si un profesional no aparece en esta lista, no tiene turnos disponibles.`)
    parts.push(`NUNCA digas "hoy" si hoy no está en las fechas de arriba.`)
  } else {
    parts.push(`No hay turnos disponibles en los próximos 14 días para ningún profesional.`)
  }

  // Upcoming appointments
  if (ctx.upcomingAppointments && ctx.upcomingAppointments.length > 0) {
    parts.push(`Turnos próximos del paciente:`)
    for (const a of ctx.upcomingAppointments) {
      parts.push(`  - ${a.date} ${a.time} — ${a.professional} (${a.specialty})`)
    }
  }

  // Current conversation state (for AI awareness)
  parts.push(`Estado de la conversación: ${ctx.state}`)
  parts.push(``)
  parts.push(`Mensaje del paciente: "${userMessage}"`)
  parts.push(``)
  parts.push(`Instrucción: Respondé como Ana, la secretaria. Un solo mensaje, corto y natural. Sin listas numeradas. Sin markdown.`)

  return parts.join('\n')
}

// ── AI API Callers ─────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 300,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI error: ${(err as { error?: { message?: string } }).error?.message ?? res.status}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemMsg?.content,
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.3,
      max_tokens: 300,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Anthropic error: ${(err as { error?: { message?: string } }).error?.message ?? res.status}`)
  }

  const data = await res.json() as { content: Array<{ text: string }> }
  return data.content[0]?.text ?? ''
}

async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 300,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`DeepSeek error: ${(err as { error?: { message?: string } }).error?.message ?? res.status}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 300,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Groq error: ${(err as { error?: { message?: string } }).error?.message ?? res.status}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callGoogle(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemMsg = messages.find(m => m.role === 'system')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Google error: ${(err as { error?: { message?: string } }).error?.message ?? res.status}`)
  }

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Load AI config from organization ───────────────────────────

async function loadConfig(orgId?: string): Promise<AiConfig | null> {
  if (!orgId) return null
  try {
    const sb = createServiceClient()
    const { data: org } = await sb
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()

    const ai = (org?.settings as Record<string, unknown> | null)?.ai as AiConfig | undefined
    if (ai?.apiKey && ai?.provider) return ai
  } catch { /* fallback */ }
  return null
}

// ── Main AI Chat Function ──────────────────────────────────────

export async function generateAiResponse(
  userMessage: string,
  ctx: AiContext,
  orgId?: string
): Promise<string | null> {
  const config = await loadConfig(orgId)
  if (!config) return null

  // Build messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  // Include recent conversation history (last 6 messages)
  const history = ctx.history ?? []
  for (const h of history.slice(-6)) {
    messages.push({ role: h.role, content: h.content })
  }

  // Add current context + user message
  messages.push({ role: 'user', content: buildAiPrompt(userMessage, ctx) })

  // Call AI provider
  try {
    switch (config.provider) {
      case 'anthropic':
        return await callAnthropic(config.apiKey, config.model || 'claude-sonnet-4-20250514', messages)
      case 'deepseek':
        return await callDeepSeek(config.apiKey, config.model || 'deepseek-chat', messages)
      case 'groq':
        return await callGroq(config.apiKey, config.model || 'llama-3.3-70b-versatile', messages)
      case 'google':
        return await callGoogle(config.apiKey, config.model || 'gemini-2.0-flash', messages)
      case 'openai':
      default:
        return await callOpenAI(config.apiKey, config.model || 'gpt-4o', messages)
    }
  } catch (err) {
    console.error('[AI Chat] Error:', err)
    return null
  }
}
