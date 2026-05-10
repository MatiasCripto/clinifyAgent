import type { BotConversation, BotMessage } from '@/lib/types/whatsapp.types'

function msg(
  id: string, phone: string,
  direction: 'inbound' | 'outbound', text: string, ts: string,
  botState?: BotConversation['state'],
): BotMessage {
  return { id, phone, direction, text, timestamp: ts, botState }
}

const T = (minutesAgo: number) => {
  const d = new Date(); d.setMinutes(d.getMinutes() - minutesAgo); return d.toISOString()
}

export const SEED_CONVERSATIONS: BotConversation[] = [
  {
    id: 'c1',
    phone: '5493514421892',
    patientName: 'Valentina Ríos',
    patientId: 'p1',
    state: 'main_menu',
    isActive: true,
    lastMessage: '¡Hola! ¿En qué te puedo ayudar?',
    lastMessageAt: T(2),
    messageCount: 6,
    unreadCount: 2,
    messages: [
      msg('m1-1', '5493514421892', 'inbound',  'hola',                                  T(8)),
      msg('m1-2', '5493514421892', 'outbound', '¡Hola Valentina! 👋 Bienvenida a Dentalink.\n\nSoy el asistente virtual de la clínica. ¿En qué te puedo ayudar hoy?', T(7), 'greeting'),
      msg('m1-3', '5493514421892', 'outbound', 'Perfecto Valentina! 😊 Elegí una opción:\n\n1️⃣ Sacar turno\n2️⃣ Cancelar turno\n3️⃣ Reprogramar turno\n4️⃣ Ver mis próximos turnos\n5️⃣ Hablar con un agente', T(7), 'main_menu'),
      msg('m1-4', '5493514421892', 'inbound',  '1',                                     T(5)),
      msg('m1-5', '5493514421892', 'outbound', '¿Qué tipo de consulta necesitás?\n\n1️⃣ Odontología General\n2️⃣ Ortodoncia\n3️⃣ Estética Dental\n4️⃣ Endodoncia\n5️⃣ Pediatría Dental', T(5), 'booking_specialty'),
      msg('m1-6', '5493514421892', 'inbound',  '2',                                     T(2)),
    ],
  },
  {
    id: 'c2',
    phone: '5493514887234',
    patientName: 'Marcos Ferreira',
    patientId: 'p2',
    state: 'booking_done',
    isActive: false,
    lastMessage: '✅ ¡Turno confirmado! 📅 Fecha: 09/05/2026',
    lastMessageAt: T(35),
    messageCount: 12,
    unreadCount: 0,
    messages: [
      msg('m2-1', '5493514887234', 'inbound',  'quiero sacar turno',                    T(60), 'idle'),
      msg('m2-2', '5493514887234', 'outbound', '¡Hola Marcos! 👋 Bienvenido a Dentalink.', T(59), 'greeting'),
      msg('m2-3', '5493514887234', 'outbound', 'Perfecto Marcos! 😊 Elegí una opción:\n\n1️⃣ Sacar turno\n2️⃣ Cancelar turno\n3️⃣ Reprogramar turno\n4️⃣ Ver mis próximos turnos\n5️⃣ Hablar con un agente', T(59), 'main_menu'),
      msg('m2-4', '5493514887234', 'inbound',  '1',                                     T(55)),
      msg('m2-5', '5493514887234', 'outbound', '¿Qué tipo de consulta necesitás?', T(55), 'booking_specialty'),
      msg('m2-6', '5493514887234', 'inbound',  '1',                                     T(52)),
      msg('m2-7', '5493514887234', 'outbound', '¿Con qué profesional preferís atenderte?', T(52), 'booking_professional'),
      msg('m2-8', '5493514887234', 'inbound',  '1',                                     T(48)),
      msg('m2-9', '5493514887234', 'outbound', '¿Para qué fecha querés el turno?',     T(48), 'booking_date'),
      msg('m2-10','5493514887234', 'inbound',  '1',                                     T(44)),
      msg('m2-11','5493514887234', 'outbound', 'Horarios disponibles:\n\n1️⃣ 09:00\n2️⃣ 10:00\n3️⃣ 11:00', T(44), 'booking_time'),
      msg('m2-12','5493514887234', 'inbound',  '2',                                     T(40)),
      msg('m2-13','5493514887234', 'outbound', '📋 Confirmación de turno\n\nPaciente: Marcos Ferreira\nEspecialidad: Odontología General\nFecha: mañana\nHorario: 10:00\n\n¿Confirmás el turno?\n\n✅ SÍ ❌ NO', T(40), 'booking_confirm'),
      msg('m2-14','5493514887234', 'inbound',  'sí',                                    T(36)),
      msg('m2-15','5493514887234', 'outbound', '✅ ¡Turno confirmado!\n\n📅 Fecha: 09/05/2026\n🕐 Hora: 10:00\n📍 Clínica Dentalink\n\nTe vamos a enviar un recordatorio 24hs antes. ¡Nos vemos! 😊', T(35), 'booking_done'),
    ],
  },
  {
    id: 'c3',
    phone: '5493515532109',
    patientName: 'Lucía Gómez',
    patientId: 'p3',
    state: 'human_handoff',
    isActive: true,
    lastMessage: 'Transferida a agente humano',
    lastMessageAt: T(10),
    messageCount: 4,
    unreadCount: 1,
    messages: [
      msg('m3-1', '5493515532109', 'inbound',  'necesito hablar con alguien',           T(15)),
      msg('m3-2', '5493515532109', 'outbound', '¡Hola Lucía! 👋 Bienvenida a Dentalink.', T(14), 'greeting'),
      msg('m3-3', '5493515532109', 'inbound',  'quiero hablar con una persona',         T(12)),
      msg('m3-4', '5493515532109', 'outbound', 'Entendido, te voy a conectar con un agente humano. Un momento por favor... 👥\n\nNuestro horario de atención es Lunes a Viernes 8:00 - 18:00hs.', T(10), 'human_handoff'),
    ],
  },
  {
    id: 'c4',
    phone: '5493514123876',
    patientName: 'Agustín Torres',
    patientId: 'p4',
    state: 'nps_survey',
    isActive: true,
    lastMessage: 'Del 0 al 10, ¿cuánto nos recomendarías?',
    lastMessageAt: T(5),
    messageCount: 2,
    unreadCount: 0,
    messages: [
      msg('m4-1', '5493514123876', 'outbound', 'Hola! ¿Cómo fue tu experiencia en nuestra última consulta? 🦷\n\nDel 0 al 10, ¿cuánto nos recomendarías a un amigo?\n\n_(0 = Nada probable · 10 = Muy probable)_', T(5), 'nps_survey'),
    ],
  },
  {
    id: 'c5',
    phone: '5493516698445',
    patientName: null,
    patientId: null,
    state: 'identify_patient',
    isActive: true,
    lastMessage: '¿Me podés decir tu nombre y apellido?',
    lastMessageAt: T(1),
    messageCount: 2,
    unreadCount: 1,
    messages: [
      msg('m5-1', '5493516698445', 'inbound',  'buenos dias',                           T(3), 'idle'),
      msg('m5-2', '5493516698445', 'outbound', '¡Hola! 👋 Bienvenido/a a Dentalink.\n\nSoy el asistente virtual de la clínica. ¿En qué te puedo ayudar hoy?', T(2), 'greeting'),
      msg('m5-3', '5493516698445', 'outbound', 'Para ayudarte mejor, ¿me podés decir tu nombre y apellido? 😊', T(2), 'identify_patient'),
    ],
  },
]
