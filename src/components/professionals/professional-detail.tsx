'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { AppointmentRow } from '@/components/dashboard/appointment-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import type { Professional, Appointment, Specialty, AvailabilityTemplate } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { Pencil, Trash2, Check, AlertTriangle, Clock } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface DayConfig {
  id?: string
  day_of_week: number
  active: boolean
  start_time: string
  end_time: string
  slot_duration: number
}

type Mode = 'view' | 'edit' | 'schedule'

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_SHORT   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DEFAULT_SLOT_DURATION = 30

interface ProfessionalDetailProps {
  professional: Professional | null
  appointments: Appointment[]
  onClose: () => void
  onEdit?: (id: string, updated: Partial<Professional>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  specialties?: Specialty[]
}

// ── Component ─────────────────────────────────────────────────

export function ProfessionalDetail({ professional, appointments, onClose, onEdit, onDelete, specialties = [] }: ProfessionalDetailProps) {
  const [mode, setMode] = useState<Mode>('view')
  const [editingForm, setEditingForm] = useState<Partial<Professional & { specialty_id: string | null }>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Schedule state
  const [days, setDays] = useState<DayConfig[]>([])
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // ── Helpers ────────────────────────────────────────────────

  function initEditingForm(p: Professional) {
    setEditingForm({
      full_name:      p.full_name,
      specialty_id:   p.specialty_id ?? '',
      phone:          p.phone ?? '',
      email:          p.email ?? '',
      bio:            p.bio ?? '',
      license_number: p.license_number ?? '',
    })
    setMode('edit')
    setConfirmDelete(false)
  }

  function initEmptyDays(): DayConfig[] {
    return Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      active: false,
      start_time: '09:00',
      end_time: '17:00',
      slot_duration: DEFAULT_SLOT_DURATION,
    }))
  }

  const fetchAvailability = useCallback(async (profId: string) => {
    setLoadingSchedule(true)
    try {
      const res = await fetch(`/api/settings/availability?professional_id=${profId}`)
      if (res.ok) {
        const templates: AvailabilityTemplate[] = await res.json()
        const empty = initEmptyDays()
        for (const t of templates) {
          empty[t.day_of_week] = {
            id: t.id,
            day_of_week: t.day_of_week,
            active: t.is_active,
            start_time: t.start_time.slice(0, 5),
            end_time: t.end_time.slice(0, 5),
            slot_duration: t.slot_duration,
          }
        }
        setDays(empty)
      }
    } catch { /* ignore */ }
    setLoadingSchedule(false)
  }, [])

  function openSchedule() {
    setMode('schedule')
    setConfirmDelete(false)
    if (professional) fetchAvailability(professional.id)
  }

  async function saveSchedule() {
    if (!professional) return
    setSavingSchedule(true)
    const active = days.filter(d => d.active)
    for (const day of active) {
      await fetch('/api/settings/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: day.id ?? null,
          professional_id: professional.id,
          day_of_week: day.day_of_week,
          start_time: day.start_time,
          end_time: day.end_time,
          slot_duration: day.slot_duration,
        }),
      })
    }
    // Also remove days that were active but now inactive
    // We compare against previously saved templates
    for (const day of days) {
      if (!day.active && day.id) {
        await fetch('/api/settings/availability', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: day.id }),
        })
      }
    }
    setSavingSchedule(false)
    setMode('view')
  }

  function toggleDay(idx: number) {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, active: !d.active } : d))
  }

  function updateDay(idx: number, field: keyof DayConfig, value: string | number | boolean) {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  // ── Guards ─────────────────────────────────────────────────

  if (!professional) return null

  const pr = professional
  const confirmed = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const pending   = appointments.filter(a => a.status === 'pending').length
  const rate      = appointments.length > 0 ? confirmed / appointments.length : 0
  const uniquePatients = new Set(appointments.map(a => a.patient_id)).size
  const byDate = [...appointments].sort((a, b) => b.starts_at.localeCompare(a.starts_at))

  async function saveEdit() {
    if (!editingForm.full_name) return
    setSaving(true)
    await onEdit?.(pr.id, editingForm)
    setSaving(false)
    setMode('view')
  }

  async function handleDelete() {
    setSaving(true)
    await onDelete?.(pr.id)
    setSaving(false)
    setConfirmDelete(false)
    onClose()
  }

  function handleClose() {
    setMode('view')
    setConfirmDelete(false)
    onClose()
  }

  const inputClass = cn(
    'w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)]',
    'bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
  )

  // ── Render: Edit mode ──────────────────────────────────────

  if (mode === 'edit') {
    return (
      <Modal open={!!professional} onClose={handleClose} size="lg" title="Editar profesional">
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Nombre completo *</label>
            <input className={inputClass} value={editingForm.full_name ?? ''} onChange={e => setEditingForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Especialidad</label>
            <select
              className={inputClass}
              value={editingForm.specialty_id ?? ''}
              onChange={e => setEditingForm(f => ({ ...f, specialty_id: e.target.value || null }))}
            >
              <option value="">Sin especialidad</option>
              {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Teléfono</label>
              <input className={inputClass} value={editingForm.phone ?? ''} onChange={e => setEditingForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" className={inputClass} value={editingForm.email ?? ''} onChange={e => setEditingForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Matrícula</label>
            <input className={inputClass} value={editingForm.license_number ?? ''} onChange={e => setEditingForm(f => ({ ...f, license_number: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Bio</label>
            <textarea rows={3} className={cn(inputClass, 'resize-none')} value={editingForm.bio ?? ''} onChange={e => setEditingForm(f => ({ ...f, bio: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={saveEdit}
              disabled={saving || !editingForm.full_name}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-60"
            >
              <Check size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              onClick={() => setMode('view')}
              className="px-4 py-2.5 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Render: Schedule mode ──────────────────────────────────

  if (mode === 'schedule') {
    return (
      <Modal open={!!professional} onClose={handleClose} size="lg" title="Horarios del profesional">
        {loadingSchedule ? (
          <div className="text-center py-12 text-[13px] text-[var(--subtle)]">Cargando horarios...</div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-[var(--subtle)] mb-4">
              Marcá los días que trabaja {professional.full_name} y configurá sus horarios.
            </p>
            {days.map((day, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
                {/* Toggle */}
                <label className="flex items-center gap-2 cursor-pointer min-w-[90px]">
                  <input
                    type="checkbox"
                    checked={day.active}
                    onChange={() => toggleDay(i)}
                    className="w-4 h-4 rounded border-[var(--border)] text-[var(--brand)] focus:ring-[var(--brand)]"
                  />
                  <span className={cn('text-[13px] font-medium', day.active ? 'text-[var(--foreground)]' : 'text-[var(--subtle)]')}>
                    {DAY_SHORT[i]}
                  </span>
                </label>

                {day.active && (
                  <>
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="flex flex-col items-center">
                        <label className="text-[9px] text-[var(--subtle)] uppercase tracking-wide mb-0.5">Desde</label>
                        <input
                          type="time"
                          value={day.start_time}
                          onChange={e => updateDay(i, 'start_time', e.target.value)}
                          className={cn(
                            'px-2 py-1.5 text-[12px] rounded-[8px] border border-[var(--border)]',
                            'bg-white text-[var(--foreground)]',
                            'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all',
                            'w-[95px]'
                          )}
                        />
                      </div>
                      <span className="text-[var(--subtle)] mt-4">—</span>
                      <div className="flex flex-col items-center">
                        <label className="text-[9px] text-[var(--subtle)] uppercase tracking-wide mb-0.5">Hasta</label>
                        <input
                          type="time"
                          value={day.end_time}
                          onChange={e => updateDay(i, 'end_time', e.target.value)}
                          className={cn(
                            'px-2 py-1.5 text-[12px] rounded-[8px] border border-[var(--border)]',
                            'bg-white text-[var(--foreground)]',
                            'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all',
                            'w-[95px]'
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col items-center min-w-[100px]">
                      <label className="text-[9px] text-[var(--subtle)] uppercase tracking-wide mb-0.5">Duración</label>
                      <select
                        value={day.slot_duration}
                        onChange={e => updateDay(i, 'slot_duration', parseInt(e.target.value))}
                        className={cn(
                          'px-2 py-1.5 text-[12px] rounded-[8px] border border-[var(--border)]',
                          'bg-white text-[var(--foreground)]',
                          'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all',
                          'w-full'
                        )}
                      >
                        {[15, 20, 25, 30, 40, 45, 50, 60, 90, 120].map(m => (
                          <option key={m} value={m}>{m} min</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-3">
              <button
                onClick={saveSchedule}
                disabled={savingSchedule}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-60"
              >
                <Check size={14} /> {savingSchedule ? 'Guardando...' : 'Guardar horarios'}
              </button>
              <button
                onClick={() => setMode('view')}
                className="px-4 py-2.5 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    )
  }

  // ── Render: View mode ──────────────────────────────────────

  return (
    <Modal open={!!professional} onClose={handleClose} size="lg" title="Perfil profesional">
      <>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <Avatar name={professional.full_name} color={professional.color} size="xl" />
            <div>
              <h3 className="text-[17px] font-bold text-[var(--foreground)]">{professional.full_name}</h3>
              <p className="text-[12px] font-medium" style={{ color: professional.color }}>
                {professional.specialty?.name ?? 'Sin especialidad'}
              </p>
              <p className="text-[11px] text-[var(--subtle)]">
                {[professional.phone, professional.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => initEditingForm(pr)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <Pencil size={12} /> Editar
              </button>
            )}
            <button
              onClick={openSchedule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Clock size={12} /> Horarios
            </button>
            {onDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-red-200 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={12} /> Eliminar
              </button>
            )}
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="mb-4 px-4 py-3 rounded-[10px] bg-red-50 border border-red-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-[12px] text-red-700 font-medium">¿Dar de baja a {professional.full_name}? Podés reactivarlo después.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 rounded-[8px] bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {saving ? '...' : 'Confirmar'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total',            value: appointments.length, color: professional.color, bg: professional.color + '15' },
            { label: 'Confirmados',      value: confirmed,           color: '#10b981',          bg: '#f0fdf4' },
            { label: 'Pendientes',       value: pending,             color: '#f59e0b',          bg: '#fffbeb' },
            { label: 'Pacientes únicos', value: uniquePatients,      color: '#6366f1',          bg: '#eef2ff' },
          ].map(s => (
            <div key={s.label} className="rounded-[10px] p-3 text-center" style={{ background: s.bg }}>
              <p className="text-[20px] font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[var(--subtle)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Attendance rate */}
        <div className="mb-5">
          <div className="flex justify-between text-[12px] mb-1.5">
            <span className="font-semibold text-[var(--foreground)]">Tasa de confirmación</span>
            <span className="font-bold" style={{ color: professional.color }}>{Math.round(rate * 100)}%</span>
          </div>
          <ProgressBar value={rate} color={professional.color} height={8} />
        </div>

        {/* Appointment history */}
        <div>
          <h4 className="text-[13px] font-semibold text-[var(--foreground)] mb-3">Historial de turnos</h4>
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {byDate.length === 0
              ? <p className="text-[12px] text-[var(--subtle)] text-center py-6">Sin turnos registrados</p>
              : byDate.map(a => <AppointmentRow key={a.id} appointment={a} showDate />)
            }
          </div>
        </div>
      </>
    </Modal>
  )
}
