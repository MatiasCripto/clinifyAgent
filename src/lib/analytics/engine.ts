import type { Appointment, Patient, NpsResponse } from '@/lib/types'
import { computePatientScore } from '@/lib/utils/patient-scores'
import { getRfmConfig } from '@/lib/utils/formatters'

// ── RFM Matrix ─────────────────────────────────────────────
export function buildRfmMatrix(patients: Patient[], appointments: Appointment[]) {
  const patAppts = groupBy(appointments, a => a.patient_id)

  const segments = patients.map(p => ({
    patient: p,
    score: computePatientScore(p.id, patAppts[p.id] ?? []),
  }))

  const SEGS = ['champion','loyal','new','at_risk','dormant','lost'] as const
  return SEGS.map(seg => {
    const members = segments.filter(s => s.score.rfm_segment === seg)
    const cfg     = getRfmConfig(seg)
    const avgLtv  = avg(members.map(m => m.score.ltv_estimated ?? estimateLtv(m.score.frequency_count ?? 0)))
    return {
      segment:     seg,
      label:       cfg.label,
      color:       cfg.color,
      bg:          cfg.bg,
      description: cfg.description,
      count:       members.length,
      pct:         patients.length ? members.length / patients.length : 0,
      avgLtv,
      totalValue:  avgLtv * members.length,
    }
  })
}

// ── Churn Risk Table ────────────────────────────────────────
export interface ChurnEntry {
  patient: Patient
  churnRisk: string
  churnProbability: number
  recencyDays: number | null
  rfmSegment: string | null
  label: string
}

export function buildChurnTable(patients: Patient[], appointments: Appointment[]): ChurnEntry[] {
  const patAppts = groupBy(appointments, a => a.patient_id)
  return patients
    .map(p => {
      const s = computePatientScore(p.id, patAppts[p.id] ?? [])
      return {
        patient:          p,
        churnRisk:        s.churn_risk ?? 'low',
        churnProbability: s.churn_probability ?? 0,
        recencyDays:      s.recency_days,
        rfmSegment:       s.rfm_segment,
        label:            s.behavior_label ?? '',
      }
    })
    .filter(e => e.churnRisk !== 'low')
    .sort((a, b) => b.churnProbability - a.churnProbability)
}

// ── Weekly Demand ───────────────────────────────────────────
export function buildWeeklyDemand(appointments: Appointment[]) {
  const DAY_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const counts = Array(7).fill(0)
  appointments.forEach(a => {
    const d = new Date(a.starts_at).getDay()
    counts[d]++
  })
  const max = Math.max(...counts)
  return DAY_LABELS.map((label, i) => ({
    label,
    count:      counts[i],
    pct:        max > 0 ? counts[i] / max : 0,
    isSaturated: counts[i] >= max * 0.8,
    isEmpty:     counts[i] <= max * 0.2,
  }))
}

// ── Hourly Demand ───────────────────────────────────────────
export function buildHourlyDemand(appointments: Appointment[]) {
  const hours: Record<number, number> = {}
  appointments.forEach(a => {
    const h = new Date(a.starts_at).getHours()
    hours[h] = (hours[h] ?? 0) + 1
  })
  return Array.from({ length: 12 }, (_, i) => {
    const h = i + 8 // 08:00–19:00
    return { label: `${String(h).padStart(2,'0')}:00`, hour: h, count: hours[h] ?? 0 }
  })
}

// ── Monthly Trend ───────────────────────────────────────────
export function buildMonthlyTrend(appointments: Appointment[]) {
  const monthly: Record<string, { total: number; confirmed: number; cancelled: number }> = {}
  appointments.forEach(a => {
    const key = a.starts_at.slice(0, 7) // YYYY-MM
    if (!monthly[key]) monthly[key] = { total: 0, confirmed: 0, cancelled: 0 }
    monthly[key].total++
    if (a.status === 'confirmed' || a.status === 'completed') monthly[key].confirmed++
    if (a.status === 'cancelled') monthly[key].cancelled++
  })
  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      label: formatMonthLabel(month),
      ...v,
      cancelRate: v.total > 0 ? v.cancelled / v.total : 0,
    }))
}

// ── NPS Trend ───────────────────────────────────────────────
export function buildNpsTrend(responses: NpsResponse[]) {
  const monthly: Record<string, number[]> = {}
  responses.forEach(r => {
    const key = r.created_at.slice(0, 7)
    if (!monthly[key]) monthly[key] = []
    monthly[key].push(r.score)
  })
  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => {
      const promoters  = scores.filter(s => s >= 9).length
      const detractors = scores.filter(s => s <= 6).length
      return {
        month,
        label:    formatMonthLabel(month),
        nps:      Math.round(((promoters - detractors) / scores.length) * 100),
        avgScore: +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
        total:    scores.length,
      }
    })
}

// ── Decision Engine ─────────────────────────────────────────
export interface Action {
  priority: 'high' | 'medium' | 'low'
  title:    string
  detail:   string
  metric:   string
  color:    string
  icon:     string
}

export function buildActionPlan(
  patients: Patient[],
  appointments: Appointment[],
  npsResponses: NpsResponse[]
): Action[] {
  const patAppts   = groupBy(appointments, a => a.patient_id)
  const scores     = patients.map(p => computePatientScore(p.id, patAppts[p.id] ?? []))
  const churnHigh  = scores.filter(s => s.churn_risk === 'high' || s.churn_risk === 'churned').length
  const cancelRate = appointments.filter(a => a.status === 'cancelled').length / (appointments.length || 1)
  const detractors = npsResponses.filter(n => n.segment === 'detractor').length
  const atRisk     = scores.filter(s => s.rfm_segment === 'at_risk').length

  const actions: Action[] = []

  if (churnHigh > 0)
    actions.push({
      priority: 'high',
      title:    `Recuperar ${churnHigh} paciente${churnHigh > 1 ? 's' : ''} en riesgo crítico`,
      detail:   'Enviar campaña de reactivación por WhatsApp con oferta de control gratuito.',
      metric:   `${churnHigh} pacientes`,
      color:    '#ef4444',
      icon:     '🚨',
    })

  if (detractors > 0)
    actions.push({
      priority: 'high',
      title:    `Gestionar ${detractors} detractor${detractors > 1 ? 'es' : ''} de NPS`,
      detail:   'Contactar directamente para resolver la queja antes de que abandonen.',
      metric:   `NPS impactado`,
      color:    '#ef4444',
      icon:     '⚠️',
    })

  if (cancelRate > 0.25)
    actions.push({
      priority: 'medium',
      title:    'Tasa de cancelación elevada',
      detail:   'Activar recordatorio automático 24h antes para reducir ausencias.',
      metric:   `${Math.round(cancelRate * 100)}% cancelaciones`,
      color:    '#f59e0b',
      icon:     '📅',
    })

  if (atRisk > 0)
    actions.push({
      priority: 'medium',
      title:    `Convertir ${atRisk} paciente${atRisk > 1 ? 's' : ''} "en riesgo" en leales`,
      detail:   'Invitarlos a una limpieza con descuento para reactivar la frecuencia.',
      metric:   `${atRisk} pacientes`,
      color:    '#f59e0b',
      icon:     '🔄',
    })

  const champions = scores.filter(s => s.rfm_segment === 'champion').length
  if (champions > 0)
    actions.push({
      priority: 'low',
      title:    `Fidelizar ${champions} campeón${champions > 1 ? 'es' : ''}`,
      detail:   'Ofrecer programa de referidos para multiplicar pacientes de calidad.',
      metric:   `${champions} embajadores potenciales`,
      color:    '#10b981',
      icon:     '⭐',
    })

  return actions
}

// ── Helpers ─────────────────────────────────────────────────
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    acc[k] = [...(acc[k] ?? []), item]
    return acc
  }, {} as Record<string, T[]>)
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

function estimateLtv(frequency: number): number {
  return frequency * 4500 // ARS avg ticket placeholder
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${names[parseInt(m) - 1]} ${y.slice(2)}`
}
