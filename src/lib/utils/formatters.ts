import { format, formatDistanceToNow, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AppointmentStatus, NpsSegment, RfmSegment, ChurnRisk } from '@/lib/types'

// ============================================================
// Date & Time
// ============================================================

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: es })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "dd/MM/yyyy 'a las' HH:mm", { locale: es })
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'HH:mm')
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return `Hoy ${format(d, 'HH:mm')}`
  if (isTomorrow(d)) return `Mañana ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Ayer ${format(d, 'HH:mm')}`
  return formatDistanceToNow(d, { addSuffix: true, locale: es })
}

export function formatDayLabel(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return 'Hoy'
  if (isTomorrow(d)) return 'Mañana'
  if (isYesterday(d)) return 'Ayer'
  return format(d, "d 'de' MMMM", { locale: es })
}

// ============================================================
// Names & Initials
// ============================================================

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

export function getFullName(first: string, last: string): string {
  return `${first} ${last}`.trim()
}

// ============================================================
// Status Labels & Colors
// ============================================================

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',  color: '#92400e', bg: '#fffbeb' },
  confirmed: { label: 'Confirmado', color: '#065f46', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelado',  color: '#991b1b', bg: '#fef2f2' },
  absent:    { label: 'Ausente',    color: '#374151', bg: '#f3f4f6' },
  completed: { label: 'Finalizado', color: '#3730a3', bg: '#eef2ff' },
}

export function getStatusConfig(status: AppointmentStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
}

export function getStatusLabel(status: AppointmentStatus): string {
  return STATUS_CONFIG[status]?.label ?? status
}

// ============================================================
// NPS
// ============================================================

export function getNpsWord(score: number): string {
  if (score >= 70) return 'Excelente'
  if (score >= 50) return 'Muy bueno'
  if (score >= 30) return 'Bueno'
  if (score >= 0)  return 'Regular'
  return 'Crítico'
}

export function getNpsColor(score: number): string {
  if (score >= 50) return '#10b981'
  if (score >= 0)  return '#f59e0b'
  return '#ef4444'
}

export function getNpsSegmentLabel(segment: NpsSegment): string {
  const map: Record<NpsSegment, string> = {
    promoter:   'Promotor',
    neutral:    'Neutro',
    detractor:  'Detractor',
  }
  return map[segment]
}

export function calculateNps(responses: { score: number }[]): number {
  if (!responses.length) return 0
  const promoters  = responses.filter(r => r.score >= 9).length
  const detractors = responses.filter(r => r.score <= 6).length
  return Math.round(((promoters - detractors) / responses.length) * 100)
}

// ============================================================
// RFM Segments
// ============================================================

const RFM_CONFIG: Record<RfmSegment, { label: string; color: string; bg: string; description: string }> = {
  champion:  { label: 'Campeón',      color: '#065f46', bg: '#f0fdf4', description: 'Compra frecuente y reciente' },
  loyal:     { label: 'Leal',         color: '#1e40af', bg: '#eff6ff', description: 'Paciente estable de largo plazo' },
  at_risk:   { label: 'En riesgo',    color: '#92400e', bg: '#fffbeb', description: 'Fue frecuente, ahora inactivo' },
  new:       { label: 'Nuevo',        color: '#5b21b6', bg: '#f5f3ff', description: 'Primera o segunda visita' },
  dormant:   { label: 'Dormido',      color: '#374151', bg: '#f9fafb', description: 'Sin actividad reciente' },
  lost:      { label: 'Perdido',      color: '#991b1b', bg: '#fef2f2', description: 'Sin actividad en mucho tiempo' },
}

export function getRfmConfig(segment: RfmSegment) {
  return RFM_CONFIG[segment] ?? RFM_CONFIG.dormant
}

// ============================================================
// Churn
// ============================================================

const CHURN_CONFIG: Record<ChurnRisk, { label: string; color: string }> = {
  low:     { label: 'Estable',         color: '#10b981' },
  medium:  { label: 'Riesgo medio',    color: '#f59e0b' },
  high:    { label: 'Alto riesgo',     color: '#ef4444' },
  churned: { label: 'Perdido',         color: '#6b7280' },
}

export function getChurnConfig(risk: ChurnRisk) {
  return CHURN_CONFIG[risk] ?? CHURN_CONFIG.low
}

// ============================================================
// Currency
// ============================================================

export function formatCurrency(amount: number | null, currency = 'ARS'): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ============================================================
// Percentage
// ============================================================

export function formatPct(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}

// ============================================================
// Compliance label
// ============================================================

export function getComplianceLabel(rate: number): { label: string; color: string } {
  if (rate >= 0.9) return { label: 'Muy cumplidor', color: '#10b981' }
  if (rate >= 0.7) return { label: 'Cumplidor',     color: '#6366f1' }
  if (rate >= 0.5) return { label: 'Regular',       color: '#f59e0b' }
  return                  { label: 'Cancela frecuente', color: '#ef4444' }
}
