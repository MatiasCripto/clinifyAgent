import { cn } from '@/lib/utils/cn'
import type { BotState } from '@/lib/types/whatsapp.types'

const STATE_CONFIG: Record<BotState, { label: string; color: string }> = {
  idle:                 { label: 'Iniciando',          color: 'bg-gray-100 text-gray-600' },
  greeting:             { label: 'Saludo',             color: 'bg-blue-100 text-blue-700' },
  identify_patient:     { label: 'Identificando',      color: 'bg-amber-100 text-amber-700' },
  ask_phone:            { label: 'Pidiendo teléfono',  color: 'bg-amber-100 text-amber-700' },
  ask_dni:              { label: 'Pidiendo DNI',       color: 'bg-amber-100 text-amber-700' },
  main_menu:            { label: 'Menú principal',     color: 'bg-indigo-100 text-indigo-700' },
  booking_specialty:    { label: 'Eligiendo especialidad', color: 'bg-purple-100 text-purple-700' },
  booking_professional: { label: 'Eligiendo profesional', color: 'bg-purple-100 text-purple-700' },
  booking_date:         { label: 'Eligiendo fecha',    color: 'bg-purple-100 text-purple-700' },
  booking_slots:        { label: 'Eligiendo horario',  color: 'bg-purple-100 text-purple-700' },
  booking_time:         { label: 'Eligiendo horario',  color: 'bg-purple-100 text-purple-700' },
  booking_confirm:      { label: 'Confirmando turno',  color: 'bg-orange-100 text-orange-700' },
  booking_done:         { label: 'Turno agendado ✓',   color: 'bg-green-100 text-green-700' },
  view_appointments:    { label: 'Viendo turnos',       color: 'bg-sky-100 text-sky-700' },
  cancel_select:        { label: 'Cancelando turno',   color: 'bg-red-100 text-red-700' },
  cancel_confirm:       { label: 'Confirm. cancelación', color: 'bg-red-100 text-red-700' },
  no_appointments:      { label: 'Sin turnos',         color: 'bg-gray-100 text-gray-600' },
  reschedule:           { label: 'Reprogramando',      color: 'bg-orange-100 text-orange-700' },
  nps_survey:           { label: 'Encuesta NPS',       color: 'bg-teal-100 text-teal-700' },
  human_handoff:        { label: '👥 Agente humano',   color: 'bg-rose-100 text-rose-700' },
  closed:               { label: 'Cerrado',            color: 'bg-gray-100 text-gray-500' },
}

export function BotStateBadge({ state, className }: { state: BotState; className?: string }) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.idle
  return (
    <span className={cn('badge text-[10px] font-medium', cfg.color, className)}>
      {cfg.label}
    </span>
  )
}
