// Re-export all types from a single entry point
export * from './database.types'

// ============================================================
// UI / Application-level types
// ============================================================

export interface NavItem {
  title: string
  href: string
  icon: string
  badge?: number
}

export interface DateRange {
  from: Date
  to: Date
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color: string
  status: string
  patientName: string
  professionalName: string
  treatment: string
}

export interface DashboardStats {
  totalAppointmentsToday: number
  confirmedToday: number
  pendingToday: number
  cancelledToday: number
  totalPatients: number
  newPatientsThisMonth: number
  npsScore: number
  npsWord: string
  npsColor: string
  monthlyRevenue: number | null
}

export interface NpsSummary {
  score: number
  total: number
  promoters: number
  neutrals: number
  detractors: number
  promoterPct: number
  neutralPct: number
  detractorPct: number
  word: string
  color: string
}

export interface RfmMatrix {
  segment: string
  label: string
  count: number
  color: string
  description: string
}

export interface TimeSlot {
  time: string
  available: boolean
  appointmentId?: string
}

export interface BookingState {
  step: 'specialty' | 'professional' | 'date' | 'time' | 'confirm'
  specialtyId?: string
  professionalId?: string
  date?: Date
  time?: string
  treatment?: string
}

// n8n webhook payload types
export interface WhatsAppIncomingMessage {
  instanceId: string
  clinicId: string
  contactId: string
  chatId: string
  message: {
    id: string
    from: string
    body: string
    type: string
    timestamp: number
  }
  contact: {
    id: string
    name: string
    phone: string
  }
}

export interface AppointmentWebhookPayload {
  appointmentId: string
  clinicId: string
  patientId: string
  type: 'created' | 'confirmed' | 'cancelled' | 'reminder' | 'nps'
}
