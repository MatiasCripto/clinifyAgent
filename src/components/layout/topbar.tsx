'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Search, PanelLeftClose, PanelLeft, Menu, CalendarDays, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/formatters'
import { createClient } from '@/lib/supabase/client'
import type { Appointment } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface TopbarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function Topbar({ sidebarCollapsed, onToggleSidebar }: TopbarProps) {
  const today = formatDate(new Date(), "EEEE d 'de' MMMM yyyy")
  const [open, setOpen] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sb = createClient()
    const start = new Date(); start.setHours(0,0,0,0)
    const end   = new Date(); end.setHours(23,59,59,999)
    sb.from('appointments')
      .select('*, patient:patients(*), professional:professionals(*)')
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('starts_at', { ascending: true })
      .then(({ data }) => setAppointments((data as Appointment[]) ?? []))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const pending = appointments.filter(a => a.status === 'pending').length

  return (
    <header className="h-[60px] bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 gap-4 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg text-[var(--subtle)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
        aria-label="Toggle sidebar"
      >
        <span className="md:hidden"><Menu size={18} /></span>
        <span className="hidden md:block">
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </span>
      </button>

      <div className="flex-1 max-w-md relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
        <input
          type="search"
          placeholder="Buscar pacientes, turnos..."
          className={cn(
            'w-full pl-9 pr-4 py-2 text-[13px] rounded-[10px]',
            'bg-[var(--surface-2)] border border-[var(--border)]',
            'text-[var(--foreground)] placeholder:text-[var(--subtle)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-0 focus:border-[var(--brand)]',
            'transition-all'
          )}
        />
      </div>

      <div className="flex-1" />

      <div className="hidden sm:flex items-center px-3 py-1.5 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)]">
        <span className="text-[12px] text-[var(--muted)] font-medium capitalize">{today}</span>
      </div>

      {/* Notifications */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="relative p-2 rounded-[10px] text-[var(--subtle)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <Bell size={18} />
          {pending > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--danger)] rounded-full" />
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-[calc(100%+8px)] w-[320px] bg-[var(--surface)] border border-[var(--border)] rounded-[14px] shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-[13px] font-semibold text-[var(--foreground)]">Turnos de hoy</span>
              <button onClick={() => setOpen(false)} className="text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {appointments.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-[var(--subtle)]">Sin turnos para hoy</div>
              ) : (
                appointments.map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <div className="w-7 h-7 rounded-full bg-[var(--brand-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CalendarDays size={13} className="text-[var(--brand)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-[var(--foreground)] truncate">
                        {a.patient?.first_name} {a.patient?.last_name}
                      </p>
                      <p className="text-[11px] text-[var(--subtle)] truncate">{a.treatment}</p>
                      <p className="text-[11px] text-[var(--subtle)]">
                        {format(parseISO(a.starts_at), 'HH:mm', { locale: es })} · {a.professional?.full_name}
                      </p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
                      a.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    )}>
                      {a.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
