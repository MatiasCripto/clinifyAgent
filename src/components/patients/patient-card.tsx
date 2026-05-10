import { cn } from '@/lib/utils/cn'
import { Avatar } from '@/components/ui/avatar'
import { ProgressBar } from '@/components/ui/progress-bar'
import { getComplianceLabel, formatDate } from '@/lib/utils/formatters'
import { computePatientScore } from '@/lib/utils/patient-scores'
import { getRfmConfig } from '@/lib/utils/formatters'
import type { Patient, Appointment } from '@/lib/types'

interface PatientCardProps {
  patient: Patient
  appointments: Appointment[]
  nextAppointment?: Appointment
  onClick?: () => void
}

export function PatientCard({ patient, appointments, nextAppointment, onClick }: PatientCardProps) {
  const score    = computePatientScore(patient.id, appointments)
  const comp     = getComplianceLabel(score.attendance_rate)
  const rfm      = score.rfm_segment ? getRfmConfig(score.rfm_segment) : null
  const fullName = `${patient.first_name} ${patient.last_name}`

  return (
    <div
      className={cn('card card-hover p-4 cursor-pointer', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={fullName} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--foreground)] truncate">{fullName}</p>
          <p className="text-[11px] text-[var(--subtle)] truncate">{patient.phone}{patient.email ? ` · ${patient.email}` : ''}</p>
          {nextAppointment ? (
            <p className="text-[11px] text-[var(--brand)] font-medium mt-0.5">
              📅 Próx: {formatDate(nextAppointment.starts_at, "dd/MM 'a las' HH:mm")}
            </p>
          ) : (
            <p className="text-[11px] text-[var(--subtle)] mt-0.5">Sin próximos turnos</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[11px] text-[var(--subtle)]">{appointments.length} turno{appointments.length !== 1 ? 's' : ''}</span>
          {rfm && (
            <span
              className="badge text-[10px]"
              style={{ background: rfm.bg, color: rfm.color }}
            >
              {rfm.label}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-[var(--muted)] font-medium">{comp.label}</span>
          <span className="font-bold" style={{ color: comp.color }}>{Math.round(score.attendance_rate * 100)}%</span>
        </div>
        <ProgressBar value={score.attendance_rate} color={comp.color} />
      </div>

      {patient.notes && (
        <p className="mt-2 text-[11px] text-[var(--subtle)]">⚠ {patient.notes}</p>
      )}
    </div>
  )
}
