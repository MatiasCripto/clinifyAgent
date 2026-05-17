'use client'

import { useState, useCallback, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { AppointmentRow } from '@/components/dashboard/appointment-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import type { Professional, Appointment, Specialty } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { useRole } from '@/lib/hooks/use-auth'
import { Pencil, Trash2, Check, AlertTriangle, Clock, ExternalLink, UserPlus, Key } from 'lucide-react'

interface DayConfig {
  day_of_week: number
  active: boolean
  start_time: string
  end_time: string
  slot_duration: number
  slot_count: number
}

type Mode = 'view' | 'edit' | 'schedule'

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TIME_OPTIONS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']
const DURATION_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 3) * 5) // 15-60 step 5

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

interface ProfessionalDetailProps {
  professional: Professional | null
  appointments: Appointment[]
  onClose: () => void
  onEdit?: (id: string, updated: Partial<Professional>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  specialties?: Specialty[]
}

export function ProfessionalDetail({ professional, appointments, onClose, onEdit, onDelete }: ProfessionalDetailProps) {
  const { isAdmin } = useRole()
  const [mode, setMode] = useState<Mode>('view')
  const [editingForm, setEditingForm] = useState<Partial<Professional & { specialty_id: string | null }>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [days, setDays] = useState<DayConfig[]>([])
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // User creation
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [userCreated, setUserCreated] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)

  const selClass = cn(
    'px-2 py-1.5 text-[12px] rounded-[8px] border border-[var(--border)]',
    'bg-[var(--surface)] text-[var(--foreground)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all'
  )

  // Load specialties for edit dropdown
  useEffect(() => {
    fetch('/api/settings/specialties').then(r => r.json()).then(d => { if (Array.isArray(d)) setSpecialties(d) }).catch(() => {})
  }, [])

  const fetchAvailability = useCallback(async (profId: string) => {
    setLoadingSchedule(true)
    try {
      const monday = getMonday(new Date())
      const weekStr = monday.toISOString().split('T')[0]
      const res = await fetch(`/api/settings/availability?professional_id=${profId}&week_start=${weekStr}`)
      const data = await res.json()
      const empty = Array.from({ length: 7 }, (_, i): DayConfig => ({
        day_of_week: i, active: false, start_time: '09:00', end_time: '17:00', slot_duration: 30, slot_count: 0
      }))
      if (res.ok && data?.schedule) {
        for (const key of Object.keys(data.schedule)) {
          const i = parseInt(key)
          const day = data.schedule[key]
          if (day && day.is_working) {
            const slots = day.slots ?? []
            empty[i] = {
              day_of_week: i,
              active: true,
              start_time: (day.start_time ?? '09:00').slice(0, 5),
              end_time: (day.end_time ?? '17:00').slice(0, 5),
              slot_duration: slots.length > 0 ? slots[0].duration : 30,
              slot_count: slots.length,
            }
          }
        }
      }
      setDays(empty)
    } catch { /* ignore */ }
    setLoadingSchedule(false)
  }, [])

  if (!professional) return null
  const pr = professional
  const confirmed = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const pending   = appointments.filter(a => a.status === 'pending').length
  const rate = appointments.length > 0 ? confirmed / appointments.length : 0
  const uniquePatients = new Set(appointments.map(a => a.patient_id)).size
  const byDate = [...appointments].sort((a, b) => b.starts_at.localeCompare(a.starts_at))

  function openSchedule() { setMode('schedule'); setConfirmDelete(false); if (professional) fetchAvailability(professional.id) }

  async function saveSchedule() {
    if (!professional) return
    setSavingSchedule(true)
    const monday = getMonday(new Date())
    const weekStr = monday.toISOString().split('T')[0]
    const schedule: Record<string, { is_working: boolean; start_time: string; end_time: string; slots: { duration: number }[] }> = {}
    for (const day of days) {
      schedule[String(day.day_of_week)] = {
        is_working: day.active,
        start_time: day.start_time,
        end_time: day.end_time,
        slots: day.active
          ? Array.from({ length: Math.max(1, day.slot_count || 1) }, () => ({ duration: day.slot_duration }))
          : [],
      }
    }
    await fetch('/api/settings/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professional_id: professional.id, clinic_id: null, week_start_date: weekStr, schedule }),
    })
    setSavingSchedule(false); setMode('view')
  }

  async function createUserAccess() {
    if (!professional || !newUserEmail || !newUserPassword) return
    setCreatingUser(true); setUserError(null)
    const res = await fetch('/api/settings/professionals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professional_id: professional.id, email: newUserEmail, password: newUserPassword, full_name: professional.full_name }),
    })
    const data = await res.json()
    if (!res.ok) { setUserError(data.error ?? 'Error al crear usuario'); setCreatingUser(false); return }
    setUserCreated(true)
    setCreatingUser(false)
  }

  function toggleDay(i: number) { setDays(p => p.map((d, idx) => idx === i ? { ...d, active: !d.active } : d)) }
  function updateDay(i: number, f: string, v: string | number) { setDays(p => p.map((d, idx) => idx === i ? { ...d, [f]: v } : d)) }

  const activeDays = days.filter(d => d.active).length
  const hasMultiSlotDays = days.some(d => d.active && d.slot_count > 1)

  if (mode === 'schedule') {
    return (
      <Modal open={!!professional} onClose={() => setMode('view')} size="lg" title={`Horarios — ${professional.full_name}`}>
        {loadingSchedule ? (
          <div className="text-center py-12 text-[13px] text-[var(--subtle)]">Cargando horarios...</div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-[var(--subtle)]">
              Seleccioná los días que trabaja {professional.full_name}, su horario y la duración de cada turno.
            </p>

            {/* Link to detailed agenda */}
            <a
              href="/settings"
              className="flex items-center gap-1.5 text-[12px] text-[var(--brand)] hover:underline"
            >
              <ExternalLink size={11} />
              Para asignar distintas duraciones a cada turno, usá Settings → Agenda
            </a>

            {activeDays === 0 && !loadingSchedule && (
              <div className="text-center py-6 text-[13px] text-[var(--subtle)]">
                No hay días configurados para esta semana. Activá los días abajo o configuralos en Settings → Agenda.
              </div>
            )}

            {days.map((day, i) => (
              <div key={i} className={cn(
                'flex items-center gap-3 p-3 rounded-[10px] border transition-colors',
                day.active
                  ? 'border-[var(--brand)]/40 bg-[var(--brand-subtle)]'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              )}>
                <label className="flex items-center gap-2 cursor-pointer min-w-[80px]">
                  <input type="checkbox" checked={day.active} onChange={() => toggleDay(i)}
                    className="w-4 h-4 rounded border-[var(--border)] text-[var(--brand)] focus:ring-[var(--brand)]" />
                  <span className={cn('text-[13px] font-semibold', day.active ? 'text-[var(--foreground)]' : 'text-[var(--subtle)]')}>
                    {DAY_LONG[i]}
                  </span>
                </label>
                {day.active ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={day.start_time} onChange={e => updateDay(i, 'start_time', e.target.value)} className={cn(selClass, 'w-[85px]')}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-[var(--subtle)] text-[12px]">a</span>
                    <select value={day.end_time} onChange={e => updateDay(i, 'end_time', e.target.value)} className={cn(selClass, 'w-[85px]')}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-[var(--subtle)] text-[12px] ml-1">· {day.slot_count > 0 ? day.slot_count : 1} turno{day.slot_count !== 1 ? 's' : ''} de</span>
                    <select value={day.slot_duration} onChange={e => updateDay(i, 'slot_duration', parseInt(e.target.value))} className={cn(selClass, 'w-[80px]')}>
                      {DURATION_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
                    </select>
                    {day.slot_count > 1 && (
                      <span className="text-[10px] text-[var(--brand)]">(misma duración para todos)</span>
                    )}
                  </div>
                ) : (
                  <span className="text-[12px] text-[var(--subtle)]">No trabaja</span>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={saveSchedule} disabled={savingSchedule}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] disabled:opacity-60">
                <Check size={14} /> {savingSchedule ? 'Guardando...' : 'Guardar horarios'}
              </button>
              <button onClick={() => setMode('view')} className="px-4 py-2.5 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)]">Cancelar</button>
            </div>
          </div>
        )}
      </Modal>
    )
  }

  return (
    <Modal open={!!professional} onClose={() => { setConfirmDelete(false); onClose() }} size="lg" title={mode === 'edit' ? 'Editar profesional' : 'Perfil profesional'}>
      {mode === 'edit' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Nombre completo *</label>
            <input className={cn(selClass, 'w-full')} value={editingForm.full_name ?? ''} onChange={e => setEditingForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Especialidad</label>
            <select className={cn(selClass, 'w-full')} value={editingForm.specialty_id ?? ''} onChange={e => setEditingForm(f => ({ ...f, specialty_id: e.target.value || null }))}>
              <option value="">Sin especialidad</option>
              {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Teléfono</label>
              <input className={cn(selClass, 'w-full')} value={editingForm.phone ?? ''} onChange={e => setEditingForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" className={cn(selClass, 'w-full')} value={editingForm.email ?? ''} onChange={e => setEditingForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Matrícula</label>
            <input className={cn(selClass, 'w-full')} value={editingForm.license_number ?? ''} onChange={e => setEditingForm(f => ({ ...f, license_number: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Bio</label>
            <textarea rows={3} className={cn(selClass, 'w-full resize-none')} value={editingForm.bio ?? ''} onChange={e => setEditingForm(f => ({ ...f, bio: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={async () => { if (!editingForm.full_name) return; setSaving(true); await onEdit?.(pr.id, editingForm); setSaving(false); setMode('view') }}
              disabled={saving || !editingForm.full_name}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] disabled:opacity-60">
              <Check size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setMode('view')} className="px-4 py-2.5 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)]">Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <Avatar name={professional.full_name} color={professional.color} size="xl" />
              <div>
                <h3 className="text-[17px] font-bold text-[var(--foreground)]">{professional.full_name}</h3>
                <p className="text-[12px] font-medium" style={{ color: professional.color }}>{professional.specialty?.name ?? 'Sin especialidad'}</p>
                <p className="text-[11px] text-[var(--subtle)]">{[professional.phone, professional.email].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {onEdit && <button onClick={() => { setEditingForm({ full_name: pr.full_name, specialty_id: pr.specialty_id ?? '', phone: pr.phone ?? '', email: pr.email ?? '', bio: pr.bio ?? '', license_number: pr.license_number ?? '' }); setMode('edit'); setConfirmDelete(false) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)]"><Pencil size={12} /> Editar</button>}
              <button onClick={openSchedule} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)]"><Clock size={12} /> Horarios</button>
              {onDelete && !confirmDelete && <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-red-200 text-[12px] text-red-500 hover:bg-red-50"><Trash2 size={12} /> Eliminar</button>}
            </div>
          </div>
          {confirmDelete && (
            <div className="mb-4 px-4 py-3 rounded-[10px] bg-red-50 border border-red-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-red-500 flex-shrink-0" /><p className="text-[12px] text-red-700 font-medium">¿Dar de baja a {professional.full_name}?</p></div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={async () => { setSaving(true); await onDelete?.(pr.id); setSaving(false); setConfirmDelete(false); onClose() }} disabled={saving} className="px-3 py-1.5 rounded-[8px] bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 disabled:opacity-60">{saving ? '...' : 'Confirmar'}</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)]">Cancelar</button>
              </div>
            </div>
          )}
          {/* ── User Access Section (admin/owner only) ── */}
          {isAdmin && (
            <div className="mb-5 p-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex items-center gap-2 mb-2">
                <Key size={13} className="text-[var(--muted)]" />
                <span className="text-[12.5px] font-semibold text-[var(--foreground)]">Acceso al sistema</span>
              </div>
              {professional.profile_id || userCreated ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[12px] text-green-600">
                    <Check size={13} />
                    Usuario vinculado — el profesional puede iniciar sesión
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--subtle)]">Rol asignado:</span>
                    <span className="badge bg-blue-100 text-blue-700 text-[10px]">Staff</span>
                    <span className="text-[10px] text-[var(--subtle)]">Turnos · Pacientes · Mensajes · Sin acceso a Settings</span>
                  </div>
                </div>
              ) : showCreateUser ? (
                <div className="space-y-2">
                  <p className="text-[12px] text-[var(--subtle)]">Creá un usuario para que {professional.full_name} pueda iniciar sesión y ver sus turnos.</p>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--subtle)]">
                    <span>Rol:</span>
                    <span className="badge bg-blue-100 text-blue-700 text-[10px]">Staff</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Email"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[12px] text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)]"
                    />
                    <input
                      type="password"
                      placeholder="Contraseña (mín. 8)"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[12px] text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)]"
                    />
                  </div>
                  {userError && <p className="text-[11px] text-red-500">{userError}</p>}
                  <div className="flex gap-2">
                    <button onClick={createUserAccess} disabled={creatingUser || !newUserEmail || newUserPassword.length < 8}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold hover:bg-[var(--brand-dark)] disabled:opacity-60">
                      <UserPlus size={12} /> {creatingUser ? 'Creando...' : 'Crear acceso'}
                    </button>
                    <button onClick={() => { setShowCreateUser(false); setUserError(null) }}
                      className="px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface)]">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[12px] text-[var(--subtle)] mb-2">Este profesional aún no tiene un usuario para iniciar sesión.</p>
                  <button onClick={() => { setShowCreateUser(true); setNewUserEmail(professional.email ?? ''); setNewUserPassword(''); setUserError(null); setUserCreated(false) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold hover:bg-[var(--brand-dark)]">
                    <UserPlus size={12} /> Crear acceso
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 mb-5">
            {[{ label: 'Total', value: appointments.length, c: professional.color }, { label: 'Confirmados', value: confirmed, c: '#10b981' }, { label: 'Pendientes', value: pending, c: '#f59e0b' }, { label: 'Pacientes', value: uniquePatients, c: '#6366f1' }].map(s => (
              <div key={s.label} className="rounded-[10px] p-3 text-center" style={{ background: s.c + '15' }}>
                <p className="text-[20px] font-bold leading-none" style={{ color: s.c }}>{s.value}</p>
                <p className="text-[10px] text-[var(--subtle)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mb-5">
            <div className="flex justify-between text-[12px] mb-1.5"><span className="font-semibold text-[var(--foreground)]">Tasa de confirmación</span><span className="font-bold" style={{ color: professional.color }}>{Math.round(rate * 100)}%</span></div>
            <ProgressBar value={rate} color={professional.color} height={8} />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-[var(--foreground)] mb-3">Historial de turnos</h4>
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {byDate.length === 0 ? <p className="text-[12px] text-[var(--subtle)] text-center py-6">Sin turnos registrados</p> : byDate.map(a => <AppointmentRow key={a.id} appointment={a} showDate />)}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
