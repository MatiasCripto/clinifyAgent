// n8n webhook payload types — used in API routes that receive n8n triggers

export interface N8nAppointmentPayload {
  appointment_id: string
  patient_id: string
  patient_name: string
  patient_phone: string
  professional_id: string
  professional_name: string
  starts_at: string          // ISO
  ends_at: string
  treatment: string
  status: string
  clinic_id: string
  organization_id: string
}

export interface N8nPatientPayload {
  patient_id: string
  first_name: string
  last_name: string
  phone: string
  whatsapp_id?: string
  email?: string
  organization_id: string
  clinic_id: string
  is_new: boolean
}

export interface N8nNpsPayload {
  patient_id: string
  patient_phone: string
  patient_name: string
  appointment_id: string
  score: number
  comment?: string
  segment: 'promoter' | 'neutral' | 'detractor'
}

export interface N8nChurnPayload {
  patient_id: string
  patient_phone: string
  patient_name: string
  last_appointment_at: string
  days_since_last: number
  churn_probability: number
  rfm_segment: string
}

export interface N8nWhatsAppInbound {
  instance: string
  phone: string
  message: string
  pushName?: string
  timestamp: number
  messageId: string
}
