import { cn } from '@/lib/utils/cn'
import { StatusBadge } from '@/components/ui/badge'
import { formatTime } from '@/lib/utils/formatters'
import type { Appointment } from '@/lib/types'

interface AppointmentRowProps {
  appointment: Appointment
  showDate?: boolean
  onClick?: () => void
}

export function AppointmentRow({ appointment, showDate, onClick }: AppointmentRowProps) {
  const professional = appointment.professional
  const patient      = appointment.patient

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-[10px]',
        'bg-[var(--surface-2)] border border-[var(--border)]',
        'transition-all duration-100',
        onClick && 'cursor-pointer hover:bg-[var(--surface-3)] hover:shadow-sm'
      )}
      onClick={onClick}
    >
      {/* Time */}
      <div className="min-w-[52px]">
        {showDate && (
          <p className="text-[10px] text-[var(--subtle)] leading-tight">{appointment.starts_at.slice(0, 10)}</p>
        )}
        <p className="text-[13px] font-bold text-[var(--brand)] tabular-nums">
          {formatTime(appointment.starts_at)}
        </p>
      </div>

      {/* Color bar from professional */}
      <div
        className="w-0.5 h-8 rounded-full flex-shrink-0"
        style={{ background: professional?.color ?? '#6366f1' }}
      />

      {/* Patient + Professional */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--foreground)] truncate">
          {patient ? `${patient.first_name} ${patient.last_name}` : 'Paciente desconocido'}
        </p>
        <p className="text-[11px] truncate" style={{ color: professional?.color ?? '#94a3b8' }}>
          {professional?.full_name ?? 'Sin profesional'}
        </p>
      </div>

      {/* Treatment */}
      <p className="text-[12px] text-[var(--muted)] hidden sm:block flex-shrink-0 max-w-[120px] truncate">
        {appointment.treatment}
      </p>

      {/* Status */}
      <StatusBadge status={appointment.status} />
    </div>
  )
}
