import type { BotIntent } from '@/lib/types/whatsapp.types'

const PATTERNS: Array<{ intent: BotIntent; patterns: RegExp[] }> = [
  {
    intent: 'greet',
    patterns: [/^(hola|buenas?|buenos? d[ií]as?|buenas? tardes?|buenas? noches?|buen d[ií]a|hey|ey)\b/i],
  },
  {
    intent: 'book_appointment',
    patterns: [/\b(turno|turnos|turnar|sacar turno|reservar|cita|consulta|quiero turno|necesito turno|agendar|agenda)\b/i],
  },
  {
    intent: 'cancel_appointment',
    patterns: [/\b(cancelar|anular|cancelaci[oó]n|no puedo ir|no voy)\b/i],
  },
  {
    intent: 'reschedule',
    patterns: [/\b(cambiar turno|reprogramar|mover turno|otro d[ií]a|otra hora|cambiar fecha)\b/i],
  },
  {
    intent: 'view_appointments',
    patterns: [/\b(mis turnos?|cuando tengo|qu[eé] turno|pr[oó]ximo turno|turno pendiente|ver turno)\b/i],
  },
  {
    intent: 'confirm',
    patterns: [/^(s[ií]|ok|dale|confirmo|confirmar|correcto|exacto|sí confirmo|perfecto|de acuerdo|ya|claro)\b/i],
  },
  {
    intent: 'deny',
    patterns: [/^(no|nop|nel|no quiero|cancelar|atr[aá]s|volver|salir)\b/i],
  },
  {
    intent: 'ask_human',
    patterns: [/\b(persona|humano|agente|hablar con alguien|recepcionista|secretaria|asesor|quiero hablar)\b/i],
  },
  {
    intent: 'thanks',
    patterns: [/^(gracias|muchas gracias|grax|grc|thx|thanks|ok gracias|listo gracias)\b/i],
  },
  {
    intent: 'select_1',
    patterns: [/^1$|^uno$|^opci[oó]n 1$/i],
  },
  {
    intent: 'select_2',
    patterns: [/^2$|^dos$|^opci[oó]n 2$/i],
  },
  {
    intent: 'select_3',
    patterns: [/^3$|^tres$|^opci[oó]n 3$/i],
  },
  {
    intent: 'select_4',
    patterns: [/^4$|^cuatro$|^opci[oó]n 4$/i],
  },
  {
    intent: 'select_5',
    patterns: [/^5$|^cinco$|^opci[oó]n 5$/i],
  },
  {
    intent: 'select_6',
    patterns: [/^6$|^seis$|^opci[oó]n 6$/i],
  },
  {
    intent: 'nps_score',
    patterns: [/^([0-9]|10)$/],
  },
]

export function classifyIntent(text: string): BotIntent {
  const normalized = text.trim()
  for (const { intent, patterns } of PATTERNS) {
    if (patterns.some(p => p.test(normalized))) return intent
  }
  return 'unknown'
}

export function extractPhone(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '').replace(/@lid$/, '')
}

export function extractText(data: { message?: Record<string, unknown> }): string {
  if (!data.message) return ''
  const m = data.message as {
    conversation?: string
    extendedTextMessage?: { text?: string }
    buttonsResponseMessage?: { selectedButtonId?: string }
    listResponseMessage?: { singleSelectReply?: { selectedRowId?: string } }
  }
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  )
}
