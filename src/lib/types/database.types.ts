// ============================================================
// Clinify SaaS · Database Types
// Auto-synced with Supabase schema
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'absent' | 'completed'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'template'
export type UserRole = 'superadmin' | 'owner' | 'admin' | 'staff' | 'viewer'
export type OrgPlan = 'starter' | 'pro' | 'enterprise'
export type RfmSegment = 'champion' | 'loyal' | 'at_risk' | 'new' | 'dormant' | 'lost'
export type ChurnRisk = 'low' | 'medium' | 'high' | 'churned'
export type NpsSegment = 'promoter' | 'neutral' | 'detractor'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: OrgPlan
  is_active: boolean
  settings: Json
  trial_started_at?: string | null
  trial_ends_at?: string | null
  created_at: string
  updated_at: string
}

export interface Clinic {
  id: string
  organization_id: string
  name: string
  address: string | null
  phone: string | null
  whatsapp_number: string | null
  timezone: string
  is_active: boolean
  settings: Json
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Specialty {
  id: string
  organization_id: string
  name: string
  color: string
  created_at: string
}

export interface Professional {
  id: string
  organization_id: string
  full_name: string
  specialty_id: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  color: string
  is_active: boolean
  bio: string | null
  license_number: string | null
  profile_id: string | null
  created_at: string
  updated_at: string
  // Joined
  specialty?: Specialty
  profile?: Profile
}

export interface AvailabilityTemplate {
  id: string
  professional_id: string
  clinic_id: string
  day_of_week: number // 0=Sun
  start_time: string
  end_time: string
  slot_duration: number
  is_active: boolean
  created_at: string
}

export interface AvailabilityBlock {
  id: string
  professional_id: string
  clinic_id: string
  starts_at: string
  ends_at: string
  reason: string | null
  created_at: string
}

export interface Patient {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  dni: string | null
  phone: string
  email: string | null
  date_of_birth: string | null
  gender: string | null
  address: string | null
  notes: string | null
  whatsapp_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Computed
  full_name?: string
  scores?: PatientScore
}

export interface Appointment {
  id: string
  clinic_id: string
  patient_id: string
  professional_id: string
  starts_at: string
  ends_at: string
  treatment: string
  status: AppointmentStatus
  notes: string | null
  cancellation_reason: string | null
  reminder_sent: boolean
  nps_sent: boolean
  google_event_id: string | null
  source: string
  created_at: string
  updated_at: string
  // Joined
  patient?: Patient
  professional?: Professional
  clinic?: Clinic
}

export interface Conversation {
  id: string
  clinic_id: string
  patient_id: string | null
  wa_contact_id: string
  wa_chat_id: string
  status: 'open' | 'closed' | 'bot'
  last_message_at: string | null
  context: Json
  created_at: string
  updated_at: string
  // Joined
  patient?: Patient
  messages?: Message[]
  last_message?: Message
}

export interface Message {
  id: string
  conversation_id: string
  wa_message_id: string | null
  direction: MessageDirection
  type: MessageType
  body: string | null
  media_url: string | null
  intent: string | null
  intent_confidence: number | null
  is_read: boolean
  sent_at: string
}

export interface NpsResponse {
  id: string
  clinic_id: string
  patient_id: string
  appointment_id: string | null
  score: number
  comment: string | null
  segment: NpsSegment
  created_at: string
  // Joined
  patient?: Patient
}

export interface PatientScore {
  id: string
  patient_id: string
  clinic_id: string
  attendance_rate: number
  total_appointments: number
  cancelled_count: number
  absent_count: number
  recency_days: number | null
  frequency_count: number | null
  monetary_value: number | null
  rfm_segment: RfmSegment | null
  churn_risk: ChurnRisk | null
  churn_probability: number | null
  ltv_estimated: number | null
  avg_ticket: number | null
  behavior_label: string | null
  computed_at: string
}

export interface AnalyticsDaily {
  id: string
  clinic_id: string
  date: string
  total_appointments: number
  confirmed_count: number
  cancelled_count: number
  absent_count: number
  completed_count: number
  new_patients: number
  nps_avg: number | null
  promoter_count: number
  detractor_count: number
  revenue_estimated: number | null
}

export interface Service {
  id: string
  organization_id: string
  name: string
  description: string | null
  price: number
  is_active: boolean
  created_at: string
}

export interface AutomationLog {
  id: string
  clinic_id: string | null
  workflow: string
  entity_type: string | null
  entity_id: string | null
  status: 'success' | 'failed' | 'skipped'
  payload: Json | null
  error: string | null
  executed_at: string
}

export interface DaySchedule {
  is_working: boolean
  start_time?: string
  end_time?: string
  slots?: SlotDuration[]
}

export interface SlotDuration {
  duration: number
}

export interface WeeklySchedule {
  id: string
  professional_id: string
  clinic_id: string | null
  week_start_date: string
  schedule: Record<string, DaySchedule>
  created_at: string
  updated_at: string
}
