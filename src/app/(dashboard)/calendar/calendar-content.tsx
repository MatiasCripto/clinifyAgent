'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay,
  addMonths, subMonths, parseISO, isToday
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AppointmentRow } from '@/components/dashboard/appointment-row'
import { StatusBadge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { Appointment } from '@/lib/types'

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function CalendarContent() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate]  = useState<Date | null>(new Date())
  const [appointments, setAppointments]  = useState<Appointment[]>([])

  useEffect(() => {
    const sb = createClient()
    sb.from('appointments')
      .select('*, patient:patients(*), professional:professionals(*)')
      .order('starts_at', { ascending: true })
      .then(({ data }) => setAppointments((data as Appointment[]) ?? []))
  }, [])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    appointments.forEach(a => {
      const d = a.starts_at.slice(0, 10)
      map.set(d, [...(map.get(d) ?? []), a])
    })
    return map
  }, [appointments])

  const selectedDayStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const selectedAppts  = selectedDayStr ? (appointmentsByDate.get(selectedDayStr) ?? []) : []

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Calendario</h1>
        <p className="text-[13px] text-[var(--subtle)] mt-0.5">
          Navegá por mes · hacé click en un día para ver los turnos
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Calendar grid */}
        <div className="xl:col-span-2 card p-5">
          {/* Nav */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={16} className="text-[var(--muted)]" />
            </button>
            <h2 className="text-[15px] font-semibold text-[var(--foreground)] capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] flex items-center justify-center transition-colors"
            >
              <ChevronRight size={16} className="text-[var(--muted)]" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-[var(--subtle)] uppercase tracking-wider py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const dateStr    = format(day, 'yyyy-MM-dd')
              const dayAppts   = appointmentsByDate.get(dateStr) ?? []
              const inMonth    = isSameMonth(day, currentMonth)
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const isTodayDay = isToday(day)

              return (
                <button
                  key={dateStr}
                  onClick={() => inMonth && setSelectedDate(day)}
                  className={cn(
                    'min-h-[70px] rounded-[10px] p-2 text-left border transition-all',
                    !inMonth && 'opacity-25 pointer-events-none',
                    inMonth && !isSelected && !isTodayDay && 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)] hover:bg-[var(--brand-subtle)]',
                    isTodayDay && !isSelected && 'border-[var(--brand)] bg-[var(--brand-subtle)]',
                    isSelected && 'border-[var(--brand)] bg-[#e0e7ff] dark:bg-[#1a1f6e]',
                  )}
                >
                  <div
                    className={cn(
                      'text-[12px] font-semibold leading-none mb-1.5',
                      isTodayDay ? 'text-[var(--brand)]' : 'text-[var(--foreground)]'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  {dayAppts.length > 0 && (
                    <>
                      <div className="flex flex-wrap gap-[3px] mb-1">
                        {dayAppts.slice(0, 4).map(a => (
                          <span
                            key={a.id}
                            className="w-[6px] h-[6px] rounded-full"
                            style={{ background: a.professional?.color ?? '#6366f1' }}
                          />
                        ))}
                      </div>
                      <div className="text-[9px] text-[var(--subtle)]">
                        {dayAppts.length} turno{dayAppts.length !== 1 ? 's' : ''}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="card p-5">
          <AnimatePresence mode="wait">
            {selectedDate ? (
              <motion.div
                key={selectedDayStr!}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className="text-[14px] font-semibold text-[var(--brand)] mb-4 capitalize">
                  📅 {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </h2>

                {selectedAppts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[13px] text-[var(--subtle)]">Sin turnos este día</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {selectedAppts
                      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                      .map(appt => (
                        <AppointmentRow key={appt.id} appointment={appt} />
                      ))
                    }
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="text-center py-16">
                <p className="text-[13px] text-[var(--subtle)]">
                  Seleccioná un día para ver sus turnos
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
