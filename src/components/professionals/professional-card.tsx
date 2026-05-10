import { cn } from '@/lib/utils/cn'
import { Avatar } from '@/components/ui/avatar'
import type { Professional, Appointment } from '@/lib/types'

interface ProfessionalCardProps {
  professional: Professional
  appointments: Appointment[]
  onClick?: () => void
}

export function ProfessionalCard({ professional, appointments, onClick }: ProfessionalCardProps) {
  const confirmed = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length
  const upcoming  = appointments.filter(a => a.starts_at >= new Date().toISOString() && a.status !== 'cancelled').length

  return (
    <div className={cn('card card-hover p-4', onClick && 'cursor-pointer')} onClick={onClick}>
      <div className="flex items-start gap-3">
        <Avatar name={professional.full_name} color={professional.color} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--foreground)] truncate">{professional.full_name}</p>
          <p className="text-[11px]" style={{ color: professional.color }}>{professional.specialty?.name ?? 'Sin especialidad'}</p>
          {professional.phone && <p className="text-[11px] text-[var(--subtle)]">{professional.phone}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <span
            className="badge text-[11px]"
            style={{ background: professional.color + '18', color: professional.color }}
          >
            {appointments.length} turnos
          </span>
          <p className="text-[10px] text-[var(--success)] mt-1">{confirmed} confirm.</p>
        </div>
      </div>
      {upcoming > 0 && (
        <p className="mt-2.5 text-[11px] text-[var(--brand)] font-medium">
          📅 {upcoming} turno{upcoming !== 1 ? 's' : ''} próximo{upcoming !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
