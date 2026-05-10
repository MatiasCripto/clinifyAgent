import type { Appointment, PatientScore } from '@/lib/types'

export function computePatientScore(
  patientId: string,
  appointments: Appointment[]
): Omit<PatientScore, 'id' | 'clinic_id'> {
  const total     = appointments.length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const absent    = appointments.filter(a => a.status === 'absent').length
  const attended  = total - cancelled - absent
  const rate      = total > 0 ? attended / total : 1

  const now       = new Date()
  const sorted    = [...appointments].sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const lastAppt  = sorted[0]
  const recencyDays = lastAppt
    ? Math.floor((now.getTime() - new Date(lastAppt.starts_at).getTime()) / 86400000)
    : null

  const last12m = appointments.filter(a => {
    const d = new Date(a.starts_at)
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1)
    return d >= cutoff
  })

  let rfm: PatientScore['rfm_segment'] = 'dormant'
  let churn: PatientScore['churn_risk'] = 'low'
  let label = 'Paciente estable'

  if (recencyDays !== null) {
    if (recencyDays <= 60 && last12m.length >= 4 && rate >= 0.85) {
      rfm = 'champion'; label = 'Campeón'
    } else if (recencyDays <= 120 && rate >= 0.75) {
      rfm = 'loyal'; label = 'Paciente leal'
    } else if (total === 1 || total === 2) {
      rfm = 'new'; label = 'Paciente nuevo'
    } else if (recencyDays > 180 && last12m.length <= 1) {
      rfm = 'at_risk'; churn = 'high'; label = 'En riesgo'
    } else if (recencyDays > 365) {
      rfm = 'lost'; churn = 'churned'; label = 'Perdido'
    }
    if (rate < 0.5) { label = 'Cancela frecuente'; churn = churn === 'low' ? 'medium' : churn }
  }

  const churnProb = churn === 'churned' ? 0.95 : churn === 'high' ? 0.7 : churn === 'medium' ? 0.35 : 0.1

  return {
    patient_id: patientId,
    attendance_rate: rate,
    total_appointments: total,
    cancelled_count: cancelled,
    absent_count: absent,
    recency_days: recencyDays,
    frequency_count: last12m.length,
    monetary_value: null,
    rfm_segment: rfm,
    churn_risk: churn,
    churn_probability: churnProb,
    ltv_estimated: null,
    avg_ticket: null,
    behavior_label: label,
    computed_at: now.toISOString(),
  }
}
