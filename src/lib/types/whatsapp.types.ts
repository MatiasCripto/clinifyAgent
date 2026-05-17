// ============================================================
// WhatsApp / Evolution API types + Bot conversation state
// ============================================================

// ── Evolution API inbound payload ───────────────────────────
export interface EvolutionWebhookPayload {
  event: 'messages.upsert' | 'messages.update' | 'connection.update' | 'qr.updated'
  instance: string
  data: EvolutionMessageData | EvolutionConnectionData
  sender?: string   // phone@s.whatsapp.net — present when remoteJid is @lid
}

export interface EvolutionMessageData {
  key: {
    remoteJid: string   // phone@s.whatsapp.net
    fromMe: boolean
    id: string
  }
  message: {
    conversation?: string
    extendedTextMessage?: { text: string }
    buttonsResponseMessage?: { selectedButtonId: string; selectedDisplayText: string }
    listResponseMessage?: { singleSelectReply: { selectedRowId: string } }
  }
  messageTimestamp: number
  pushName?: string
}

export interface EvolutionConnectionData {
  state: 'open' | 'close' | 'connecting'
  statusReason?: number
}

// ── Bot conversation state machine ──────────────────────────
export type BotState =
  | 'idle'
  | 'greeting'
  | 'identify_patient'
  | 'ask_phone'
  | 'ask_dni'
  | 'main_menu'
  | 'booking_specialty'
  | 'booking_professional'
  | 'booking_date'
  | 'booking_slots'
  | 'booking_time'
  | 'booking_confirm'
  | 'booking_done'
  | 'cancel_select'
  | 'cancel_confirm'
  | 'no_appointments'
  | 'view_appointments'
  | 'reschedule'
  | 'nps_survey'
  | 'human_handoff'
  | 'closed'

export type BotIntent =
  | 'greet'
  | 'book_appointment'
  | 'cancel_appointment'
  | 'reschedule'
  | 'view_appointments'
  | 'confirm'
  | 'deny'
  | 'select_1' | 'select_2' | 'select_3' | 'select_4' | 'select_5' | 'select_6'
  | 'ask_human'
  | 'thanks'
  | 'nps_score'
  | 'unknown'

export interface BotContext {
  phone: string
  patientId: string | null
  patientName: string | null
  pendingPhone: string | null
  pendingDni: string | null
  state: BotState
  // booking flow
  selectedSpecialty: string | null
  selectedProfessional: string | null
  selectedDate: string | null
  selectedTime: string | null
  selectedAppointmentId: string | null
  // injected by route.ts from DB
  specialties?: string[]
  professionals?: string[]
  availableSlotsList?: { date: string; time: string; label: string }[]
  availableDatesList?: { date: string; label: string }[]
  upcomingAppointments?: { id: string; date: string; time: string; professional: string; specialty: string }[]
  // meta
  lastMessageAt: string
  messageCount: number
  isKnownPatient: boolean
  clinicName?: string
  // conversation history for AI
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface BotMessage {
  id: string
  phone: string
  direction: 'inbound' | 'outbound'
  text: string
  timestamp: string
  botState?: BotState
  intent?: BotIntent
}

export interface BotConversation {
  id: string
  phone: string
  patientName: string | null
  patientId: string | null
  state: BotState
  isActive: boolean
  lastMessage: string
  lastMessageAt: string
  messageCount: number
  unreadCount: number
  messages: BotMessage[]
}

// ── Evolution API outbound ───────────────────────────────────
export interface SendTextPayload {
  number: string
  textMessage: { text: string }
  options?: { delay?: number; presence?: 'composing' | 'recording' }
}

export interface SendListPayload {
  number: string
  listMessage: {
    title: string
    description: string
    buttonText: string
    footerText?: string
    sections: Array<{
      title: string
      rows: Array<{ title: string; description?: string; rowId: string }>
    }>
  }
}
