'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { AppointmentRow } from '@/components/dashboard/appointment-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import type { Professional, Appointment, Specialty } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { Pencil, Trash2, Check, AlertTriangle } from 'lucide-react'

interface ProfessionalDetailProps {
  professional: Professional | null
  appointments: Appointment[]
  onClose: () => void
  onEdit?: (id: string, updated: Partial<Professional>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  specialties?: Specialty[]
}

export function ProfessionalDetail({ professional, appointments, onClose, onEdit, onDelete, specialties = [] }: ProfessionalDetailProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Professional & { specialty_id: string | null }>>({})

  if (!professional) return null

  // All variables below are safe — professional is non-null past the guard above
  const pr = professional
  const confirmed = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const pending   = appointments.filter(a => a.status === 'pending').length
  const rate      = appointments.length > 0 ? confirmed / appointments.length : 0
  const uniquePatients = new Set(appointments.map(a => a.patient_id)).size
  const byDate = [...appointments].sort((a, b) => b.starts_at.localeCompare(a.starts_at))

  function startEdit() {
    setForm({
      full_name:      pr.full_name,
      specialty_id:   pr.specialty_id ?? '',
      phone:          pr.phone ?? '',
      email:          pr.email ?? '',
      bio:            pr.bio ?? '',
      license_number: pr.license_number ?? '',
    })
    setEditing(true)
    setConfirmDelete(false)
  }

  async function saveEdit() {
    if (!form.full_name) return
    setSaving(true)
    await onEdit?.(pr.id, form)
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    setSaving(true)
    await onDelete?.(pr.id)
    setSaving(false)
    setConfirmDelete(false)
    onClose()
  }

  function handleClose() {
    setEditing(false)
    setConfirmDelete(false)
    onClose()
  }

  const inputClass = cn(
    'w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)]',
    'bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
  )

  return (
    <Modal open={!!professional} onClose={handleClose} size="lg" title={editing ? 'Editar profesional' : 'Perfil profesional'}>
      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Nombre completo *</label>
            <input className={inputClass} value={form.full_name ?? ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Especialidad</label>
            <select
              className={inputClass}
              value={form.specialty_id ?? ''}
              onChange={e => setForm(f => ({ ...f, specialty_id: e.target.value || null }))}
            >
              <option value="">Sin especialidad</option>
              {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Teléfono</label>
              <input className={inputClass} value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" className={inputClass} value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Matrícula</label>
            <input className={inputClass} value={form.license_number ?? ''} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Bio</label>
            <textarea rows={3} className={cn(inputClass, 'resize-none')} value={form.bio ?? ''} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={saveEdit}
              disabled={saving || !form.full_name}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-60"
            >
              <Check size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2.5 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
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
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Pencil size={12} /> Editar
                </button>
              )}
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
      )}
    </Modal>
  )
}
