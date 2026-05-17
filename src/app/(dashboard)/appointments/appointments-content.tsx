'use client'

import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { AppointmentRow } from '@/components/dashboard/appointment-row'
import { StatCard } from '@/components/ui/stat-card'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { CalendarDays, CheckCircle2, Clock, XCircle, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Search } from 'lucide-react'
import type { Appointment, AppointmentStatus, Patient, Professional } from '@/lib/types'

type FilterStatus = 'all' | AppointmentStatus

const FILTERS: { key: FilterStatus; label: string; color?: string }[] = [
  { key: 'all',       label: 'Todos'       },
  { key: 'confirmed', label: 'Confirmados', color: '#10b981' },
  { key: 'pending',   label: 'Pendientes',  color: '#f59e0b' },
  { key: 'cancelled', label: 'Cancelados',  color: '#ef4444' },
  { key: 'absent',    label: 'Ausentes',    color: '#6b7280' },
  { key: 'completed', label: 'Finalizados', color: '#6366f1' },
]

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'pending',   label: 'Pendiente'  },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'completed', label: 'Finalizado' },
  { value: 'cancelled', label: 'Cancelado'  },
  { value: 'absent',    label: 'Ausente'    },
]

const DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
  { label: '90 min', minutes: 90 },
]

type ApptForm = {
  patientId: string
  professionalId: string
  startsAt: string     // datetime-local format
  durationMin: number
  treatment: string
  notes: string
  status: AppointmentStatus
}

const EMPTY_FORM: ApptForm = {
  patientId: '',
  professionalId: '',
  startsAt: '',
  durationMin: 30,
  treatment: '',
  notes: '',
  status: 'pending',
}

export function AppointmentsContent() {
  const { currentClinic, authUser } = useAuth()
  const userProfileId = authUser?.profile?.id
  const userRole = authUser?.role
  const [staffProfessionalId, setStaffProfessionalId] = useState<string | null>(null)

  const [filter,       setFilter]       = useState<FilterStatus>('all')
  const [search,       setSearch]       = useState('')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients,     setPatients]     = useState<Patient[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<Appointment | null>(null)
  const [modalMode,    setModalMode]    = useState<'create' | 'edit'>('create')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [form,         setForm]         = useState<ApptForm>(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('appointments').select('*, patient:patients(*), professional:professionals(*)').order('starts_at', { ascending: false }),
      sb.from('patients').select('*').eq('is_active', true).order('last_name'),
      sb.from('professionals').select('*, specialty:specialties(*)').eq('is_active', true).order('full_name'),
    ]).then(async ([appts, pats, profs]) => {
      const profsData = (profs.data as Professional[]) ?? []

      // For staff users, find their linked professional
      if (userRole === 'staff' && userProfileId) {
        const linked = profsData.find((p) => (p as Professional).profile_id === userProfileId)
        if (linked) {
          setStaffProfessionalId(linked.id)
          // Filter appointments to only show staff's own
          const apptsData = (appts.data as Appointment[]) ?? []
          setAppointments(apptsData.filter(a => a.professional_id === linked.id))
          setProfessionals([linked]) // Only show themselves in dropdown
          setPatients((pats.data as Patient[]) ?? [])
          setLoading(false)
          return
        }
      }

      setAppointments((appts.data as Appointment[]) ?? [])
      setPatients((pats.data as Patient[]) ?? [])
      setProfessionals(profsData)
      setLoading(false)
    })
  }, [userRole, userProfileId])

  const counts = useMemo(() => ({
    all:       appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    pending:   appointments.filter(a => a.status === 'pending').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    absent:    appointments.filter(a => a.status === 'absent').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  }), [appointments])

  const filtered = useMemo(() => {
    let list = filter === 'all' ? appointments : appointments.filter(a => a.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.patient?.first_name?.toLowerCase().includes(q) ||
        a.patient?.last_name?.toLowerCase().includes(q)  ||
        a.professional?.full_name?.toLowerCase().includes(q) ||
        a.treatment?.toLowerCase().includes(q)
      )
    }
    return list
  }, [appointments, filter, search])

  function openCreate() {
    // Default start: today at 09:00
    const now = new Date()
    now.setHours(9, 0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    // Auto-select professional for staff
    setForm({ ...EMPTY_FORM, startsAt: local, professionalId: staffProfessionalId ?? '' })
    setModalMode('create')
    setConfirmDelete(false)
    setModalOpen(true)
  }

  function openEdit(appt: Appointment) {
    setSelected(appt)
    const d = new Date(appt.starts_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    const diffMin = appt.ends_at
      ? Math.round((new Date(appt.ends_at).getTime() - d.getTime()) / 60000)
      : 30
    setForm({
      patientId:      appt.patient_id,
      professionalId: appt.professional_id,
      startsAt:       local,
      durationMin:    diffMin,
      treatment:      appt.treatment ?? '',
      notes:          appt.notes ?? '',
      status:         appt.status,
    })
    setModalMode('edit')
    setConfirmDelete(false)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelected(null)
    setConfirmDelete(false)
  }

  async function handleSave() {
    if (!form.patientId || !form.professionalId || !form.startsAt || !form.treatment) return
    setSaving(true)
    const sb = createClient()
    const clinicId = currentClinic?.id
    const startsAt = new Date(form.startsAt).toISOString()
    const endsAt   = new Date(new Date(form.startsAt).getTime() + form.durationMin * 60000).toISOString()

    if (modalMode === 'create') {
      const { data } = await sb.from('appointments').insert({
        clinic_id:       clinicId ?? '',
        patient_id:      form.patientId,
        professional_id: form.professionalId,
        starts_at:       startsAt,
        ends_at:         endsAt,
        treatment:       form.treatment,
        notes:           form.notes || null,
        status:          form.status,
        source:          'dashboard',
        reminder_sent:   false,
        nps_sent:        false,
      }).select('*, patient:patients(*), professional:professionals(*)').single()
      if (data) setAppointments(prev => [data as Appointment, ...prev])
    } else if (selected) {
      const { data } = await sb.from('appointments')
        .update({
          patient_id:      form.patientId,
          professional_id: form.professionalId,
          starts_at:       startsAt,
          ends_at:         endsAt,
          treatment:       form.treatment,
          notes:           form.notes || null,
          status:          form.status,
        })
        .eq('id', selected.id)
        .select('*, patient:patients(*), professional:professionals(*)')
        .single()
      if (data) setAppointments(prev => prev.map(a => a.id === selected.id ? (data as Appointment) : a))
    }

    setSaving(false)
    closeModal()
  }

  async function handleDelete() {
    if (!selected) return
    setSaving(true)
    const sb = createClient()
    await sb.from('appointments').delete().eq('id', selected.id)
    setAppointments(prev => prev.filter(a => a.id !== selected.id))
    setSaving(false)
    closeModal()
  }

  const inputClass = cn(
    'w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)]',
    'bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
  )

  const canSave = !!form.patientId && !!form.professionalId && !!form.startsAt && !!form.treatment

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Turnos</h1>
          <p className="text-[13px] text-[var(--subtle)] mt-0.5">{appointments.length} turnos registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors"
        >
          <Plus size={15} /> Nuevo turno
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total"       value={counts.all}        icon={CalendarDays}  iconColor="#6366f1" />
        <StatCard label="Confirmados" value={counts.confirmed}  icon={CheckCircle2}  iconColor="#10b981" />
        <StatCard label="Pendientes"  value={counts.pending}    icon={Clock}         iconColor="#f59e0b" />
        <StatCard label="Cancelados"  value={counts.cancelled}  icon={XCircle}       iconColor="#ef4444" />
      </div>

      {/* List card */}
      <div className="card p-5">
        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
            <input
              type="search"
              placeholder="Buscar paciente, profesional, tratamiento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(
                'w-full pl-8 pr-3 py-2 text-[13px] rounded-[10px]',
                'bg-[var(--surface-2)] border border-[var(--border)]',
                'text-[var(--foreground)] placeholder:text-[var(--subtle)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
              )}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all',
                  filter === f.key
                    ? 'text-white border-transparent'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-2)]'
                )}
                style={filter === f.key ? { background: f.color ?? '#6366f1', borderColor: f.color ?? '#6366f1' } : {}}
              >
                {f.label}
                <span className={cn('ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]', filter === f.key ? 'bg-white/20' : 'bg-[var(--surface-2)]')}>
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-12 text-[var(--subtle)] text-[13px]">Cargando turnos...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[var(--subtle)] text-[13px]">Sin resultados para los filtros seleccionados</div>
          ) : (
            filtered.map(appt => (
              <AppointmentRow key={appt.id} appointment={appt} showDate onClick={() => openEdit(appt)} />
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <p className="mt-3 text-[11px] text-[var(--subtle)] text-right">
            {filtered.length} turno{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={modalMode === 'create' ? 'Nuevo turno' : 'Editar turno'}
        size="sm"
      >
        <div className="space-y-4">
          {/* Paciente */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Paciente *</label>
            <select className={inputClass} value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}>
              <option value="">Seleccionar paciente...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>

          {/* Profesional */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Profesional *</label>
            <select className={inputClass} value={form.professionalId} onChange={e => setForm(f => ({ ...f, professionalId: e.target.value }))}>
              <option value="">Seleccionar profesional...</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Fecha y hora *</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.startsAt}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Duración</label>
              <select className={inputClass} value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: Number(e.target.value) }))}>
                {DURATIONS.map(d => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
              </select>
            </div>
          </div>

          {/* Tratamiento */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Tratamiento *</label>
            <input
              className={inputClass}
              placeholder="Ej: Consulta general, Control..."
              value={form.treatment}
              onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))}
            />
          </div>

          {/* Estado (solo en edición) */}
          {modalMode === 'edit' && (
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Estado</label>
              <select className={inputClass} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AppointmentStatus }))}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Notas</label>
            <textarea
              rows={2}
              className={cn(inputClass, 'resize-none')}
              placeholder="Observaciones opcionales..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="px-4 py-3 rounded-[10px] bg-red-50 border border-red-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-[12px] text-red-700 font-medium">¿Eliminar este turno permanentemente?</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-[8px] bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                >
                  {saving ? '...' : 'Eliminar'}
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

          {/* Actions */}
          <div className={cn('flex gap-2 pt-1', modalMode === 'edit' ? 'justify-between' : '')}>
            {modalMode === 'edit' && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-red-200 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            )}
            <div className="flex gap-2 flex-1 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2.5 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-60"
              >
                <Pencil size={13} /> {saving ? 'Guardando...' : modalMode === 'create' ? 'Crear turno' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
