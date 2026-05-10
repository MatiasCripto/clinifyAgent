import { cn } from '@/lib/utils/cn'
import type { AppointmentStatus } from '@/lib/types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
  className?: string
}

const VARIANTS = {
  default: 'bg-[var(--surface-2)] text-[var(--muted)]',
  success: 'bg-[var(--success-bg)] text-green-800 dark:text-green-300',
  warning: 'bg-[var(--warning-bg)] text-amber-800 dark:text-amber-300',
  danger:  'bg-[var(--danger-bg)]  text-red-800 dark:text-red-300',
  info:    'bg-[var(--info-bg)]    text-cyan-800 dark:text-cyan-300',
  brand:   'bg-[var(--brand-subtle)] text-[var(--brand)]',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('badge', VARIANTS[variant], className)}>
      {children}
    </span>
  )
}

// Specialized appointment status badge
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const map: Record<AppointmentStatus, { label: string; variant: BadgeProps['variant'] }> = {
    pending:   { label: 'Pendiente',  variant: 'warning' },
    confirmed: { label: 'Confirmado', variant: 'success' },
    cancelled: { label: 'Cancelado',  variant: 'danger'  },
    absent:    { label: 'Ausente',    variant: 'default' },
    completed: { label: 'Finalizado', variant: 'brand'   },
  }
  const config = map[status] ?? map.pending
  return <Badge variant={config.variant}>{config.label}</Badge>
}
