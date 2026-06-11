// ── Conversational AI agent for WhatsApp bot ─────────────────────
// Agent architecture: the AI receives ALL data and drives the
// conversation naturally. The backend only executes validated actions.
//
// Data flow:
//   DB → full context builder → AI agent → structured JSON response
//   JSON response → parser → send message + execute action (if any)
//
// The AI NEVER invents data. All specialties, professionals, and
// availability come from the context built by the webhook handler.

import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/crypto/encryption'

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

// Parsed response from the AI agent
export interface AgentResponse {
  message: string       // What to send to the patient
  action: AgentAction | null  // Action to execute (if any)
}

export interface AgentAction {
  type: 'book' | 'cancel' | 'human_handoff'
  // For book:
  specialty?: string
  professional?: string
  date?: string       // DD/MM/YYYY
  time?: string       // HH:MM
  area?: string       // optional service area
  patientName?: string
  patientDni?: string
  // For cancel:
  appointmentId?: string     // deprecated — kept for backward compat
  appointmentIds?: string[]  // array of appointment IDs to cancel
  // For human_handoff:
  reason?: string
}

// ── Agent System Prompt ───────────────────────────────────────

const SYSTEM_PROMPT = `SOS UNA AGENTE AUTÓNOMA. Sos ClinifyAgent, la secretaria virtual de una clínica médica. Atendés por WhatsApp.

PERSONALIDAD:
- Cálida, eficiente, humana, cercana, profesional
- Mensajes CORTOS (1-3 oraciones). UNA pregunta por vez.
- Emojis leves: 😊 👍 ✅
- NO parecés chatbot. Sonás como una secretaria de verdad.

PROHIBIDO:
- Frases de robot: "Seleccione una opción", "Ingrese sus datos", "Asistente virtual", "Menú principal"
- Listas numeradas, bullets, markdown, negritas, asteriscos
- Repetir el mismo mensaje
- Inventar datos que NO están en el contexto
- Mencionar la duración de las áreas o servicios al paciente (ej: "30 min", "45 min"). Eso es interno, el paciente no necesita saberlo.

DATOS (tu ÚNICA fuente de verdad):
- El contexto tiene todo lo que necesitás: profesionales, especialidades, áreas, disponibilidad, turnos del paciente
- Lo que NO está en el contexto, NO EXISTE. No lo inventes.
- Usá los nombres EXACTOS del contexto, sin cambiarlos.
- Cada día de la agenda tiene áreas asignadas con horarios específicos. Solo ofrecés lo que está cargado para ese día.
- Los slots sin área asignada NO EXISTEN para el paciente. No los ofrezcas nunca.

FLUJO NATURAL:
- Saludar brevemente con tu nombre, preguntar qué necesita
- El paciente dice especialidad → mostrás profesionales de ESA especialidad
- El profesional tiene áreas → preguntás qué área necesita (solo las áreas reales del contexto)
- El paciente elige área → mostrás SOLO los días que tienen disponibilidad para ESA área específica
- El paciente elige día → mostrás SOLO los horarios disponibles para ESA área en ESE día
- El paciente elige horario → pedís nombre completo y DNI
- Tenés nombre y DNI → resumís el turno y pedís confirmación explícita
- Confirmación → reservás (action="book")

FILTRADO POR ÁREA (MUY IMPORTANTE):
- El contexto agrupa los horarios por área así: "Vie 29/5 → Implantes: 09:00 | Limpieza: 08:00"
- Cuando el paciente elige un área, buscá en el contexto los horarios bajo ESE nombre de área exacto
- Ofrecé SOLO esos horarios. No ofrezcas horarios de otras áreas.
- Si el paciente pide un área que no tiene disponibilidad ese día, informale y ofrecé los días donde SÍ hay disponibilidad para esa área.

ANTES DE CONFIRMAR:
- Si el contexto ya tiene el nombre del paciente, NO lo pidas de nuevo — usá ese nombre directamente en el action.
- Si el paciente NO está identificado en el contexto, pedí nombre completo y DNI antes de reservar.
- El teléfono se obtiene automáticamente del chat, no lo pidas.
- No reserves sin tener nombre y DNI de alguna de las dos formas anteriores.

CONFIRMACIÓN OBLIGATORIA:
- ⛔ NUNCA reserves ni canceles sin confirmación EXPLÍCITA del paciente.
- ⛔ El paciente confirma con: "sí", "si", "confirmo", "confirmar", "dale", "ok", "va", "listo"
- ⛔ Si dice algo ambiguo como "bueno", "joya", "genial" → respondé: "¿Me confirmás el turno? 😊"
- Solo ponés action="book" cuando el paciente YA confirmó explícitamente.

CANCELACIONES:
- Si el paciente quiere cancelar, mostrále sus turnos activos y preguntá cuál quiere cancelar.
- Confirmá antes de cancelar, igual que con las reservas.
- Solo ponés action="cancel" cuando el paciente YA confirmó explícitamente.

DERIVACIÓN A HUMANO:
- Si el paciente dice "quiero hablar con alguien", "urgencia", "emergencia", "queja", "no me entendés", o muestra frustración clara → respondé con action type "human_handoff" y message: "Entendido, te conecto con alguien del equipo ahora mismo. En breve te contactan 😊"
- Si después de 3 intentos no pudiste resolver su consulta → derivá a humano.
- Ejemplo de JSON para este caso:
{
  "message": "Entendido, te conecto con alguien del equipo ahora mismo. En breve te contactan 😊",
  "action": { "type": "human_handoff", "reason": "Paciente solicitó atención humana" }
}

RESPONDÉ SIEMPRE EN JSON:
{
  "message": "lo que le decís al paciente",
  "action": null
}

O si ya confirmó una reserva:
{
  "message": "¡Listo! ✅ Turno reservado.",
  "action": {
    "type": "book",
    "specialty": "Odontologia",
    "professional": "Denise Rodsevich",
    "date": "18/05/2026",
    "time": "10:30",
    "area": "Implantes",
    "patientName": "Juan Pérez",
    "patientDni": "12345678"
  }
}

O si ya confirmó una cancelación (puede ser uno o varios turnos):
{
  "message": "Listo, cancelé tus turnos 👍",
  "action": {
    "type": "cancel",
    "appointmentIds": ["id-1", "id-2"]
  }
}

⛔ RESPONDÉ SOLO EL JSON, NADA MÁS. Sin texto antes ni después.`

// ── Build context for the AI agent ──────────────────────────

export function buildAiPrompt(
  userMessage: string,
  ctx: AiContext
): string {
  console.log('[buildAiPrompt] patientName:', ctx.patientName, '| isKnownPatient:', ctx.isKnownPatient)
  const parts: string[] = []

  // Clinic info
  if (ctx.clinicName) parts.push(`Clínica: ${ctx.clinicName}`)

  // Patient info — sanitize: skip garbage names from stale state machine
  if (ctx.patientName && !ctx.patientName.includes(':') && !ctx.patientName.startsWith('Clínica') && !ctx.patientName.startsWith('Paciente') && ctx.patientName.trim().split(/\s+/).length >= 2) {
    parts.push(`Paciente: ${ctx.patientName}`)
    if (ctx.isKnownPatient) parts.push(`Es paciente registrado.`)
  }

  // Specialties & professionals
  if (ctx.specialties.length > 0) {
    parts.push(`Especialidades: ${ctx.specialties.join(', ')}`)
  }
  if (ctx.professionalsBySpecialty && Object.keys(ctx.professionalsBySpecialty).length > 0) {
    parts.push(`Especialidad → profesionales:`)
    for (const [spec, profs] of Object.entries(ctx.professionalsBySpecialty)) {
      parts.push(`  ${spec}: ${profs.join(', ')}`)
    }
  }

  // Availability for ALL professionals — each day is a separate line with areas & times
  if (ctx.allAvailability && Object.keys(ctx.allAvailability).length > 0) {
    parts.push(`Disponibilidad próximos 14 días (día → área horario):`)
    for (const [prof, lines] of Object.entries(ctx.allAvailability)) {
      parts.push(`  ${prof}:`)
      for (const line of lines) {
        parts.push(`    ${line}`)
      }
    }
  } else {
    parts.push(`No hay turnos disponibles en los próximos 14 días.`)
  }

  // Specific slots if in booking flow
  if (ctx.availableSlots && ctx.availableSlots.length > 0) {
    parts.push(`Horarios disponibles para el día elegido: ${ctx.availableSlots.map(s => s.label).join(', ')}`)
  }

  // Areas for selected professional
  if (ctx.professionalAreas) {
    parts.push(`Áreas del profesional: ${ctx.professionalAreas}`)
  }

  // Patient's upcoming appointments
  if (ctx.upcomingAppointments && ctx.upcomingAppointments.length > 0) {
    parts.push(`Turnos del paciente:`)
    for (const a of ctx.upcomingAppointments) {
      parts.push(`  - ID:${a.id} | ${a.date} ${a.time} | ${a.professional} (${a.specialty})`)
    }
  } else {
    parts.push(`El paciente no tiene turnos registrados.`)
  }

  parts.push(``)
  parts.push(`Mensaje del paciente: "${userMessage}"`)

  return parts.join('\n')
}

// ── Parse agent JSON response ──────────────────────────────

export function parseAgentResponse(raw: string): AgentResponse {
  try {
    // Try to extract JSON from the response (handle potential markdown wrapping)
    let json = raw.trim()
    // Remove markdown code block if present
    if (json.startsWith('```')) {
      json = json.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    const parsed = JSON.parse(json) as { message?: string; action?: AgentAction | null }
    if (parsed.message) {
      return {
        message: parsed.message,
        action: parsed.action || null,
      }
    }
  } catch { /* fall through to fallback */ }

  // Fallback: return raw text as message, no action
  return { message: raw.trim(), action: null }
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
    if (ai?.apiKey && ai?.provider) {
      // Decrypt apiKey if it was stored encrypted (backward compatible with plain text)
      return { ...ai, apiKey: decrypt(ai.apiKey) }
    }
  } catch { /* fallback */ }
  return null
}

// ── Main AI Agent Function ─────────────────────────────────

export async function generateAiResponse(
  userMessage: string,
  ctx: AiContext,
  orgId?: string
): Promise<AgentResponse | null> {
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
  let raw: string | null = null
  try {
    switch (config.provider) {
      case 'anthropic':
        raw = await callAnthropic(config.apiKey, config.model || 'claude-sonnet-4-20250514', messages)
        break
      case 'deepseek':
        raw = await callDeepSeek(config.apiKey, config.model || 'deepseek-chat', messages)
        break
      case 'groq':
        raw = await callGroq(config.apiKey, config.model || 'llama-3.3-70b-versatile', messages)
        break
      case 'google':
        raw = await callGoogle(config.apiKey, config.model || 'gemini-2.0-flash', messages)
        break
      case 'openai':
      default:
        raw = await callOpenAI(config.apiKey, config.model || 'gpt-4o', messages)
        break
    }
  } catch (err) {
    console.error('[AI Agent] Error:', err)
    return null
  }

  if (!raw) return null
  return parseAgentResponse(raw)
}
