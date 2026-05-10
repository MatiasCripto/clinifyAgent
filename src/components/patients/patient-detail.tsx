'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { ProgressBar } from '@/components/ui/progress-bar'
import { AppointmentRow } from '@/components/dashboard/appointment-row'
import { Odontogram } from '@/components/patients/odontogram'
import type { ToothCondition, ToothRecord } from '@/components/patients/odontogram'
import { computePatientScore } from '@/lib/utils/patient-scores'
import { getComplianceLabel, getRfmConfig, getChurnConfig, formatDate, formatPct } from '@/lib/utils/formatters'
import type { Patient, Appointment, NpsResponse } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { Pencil, Trash2, Check, AlertTriangle, Plus, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'

type PatientTab = 'general' | 'odontograma' | 'historial'

interface ClinicalRecord {
  id: string
  patient_id: string
  clinic_id: string
  professional_id: string | null
  session_date: string
  chief_complaint: string | null
  diagnosis: string | null
  notes: string | null
  created_at: string
  treatments?: ClinicalTreatment[]
}

interface ClinicalTreatment {
  id: string
  clinical_record_id: string
  tooth_number: number | null
  description: string | null
  amount: number | null
  status: 'planned' | 'in_progress' | 'completed'
}

interface PatientDetailProps {
  patient: Patient | null
  appointments: Appointment[]
  npsResponses: NpsResponse[]
  onClose: () => void
  onEdit?: (id: string, updated: Partial<Patient>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

const TREATMENT_STATUS_LABEL: Record<string, string> = {
  planned: 'Planificado', in_progress: 'En progreso', completed: 'Completado',
}
const TREATMENT_STATUS_COLOR: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700',
}

export function PatientDetail({ patient, appointments, npsResponses, onClose, onEdit, onDelete }: PatientDetailProps) {
  const { currentClinic } = useAuth()
  const [tab, setTab]             = useState<PatientTab>('general')
  const [editing, setEditing]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState<Partial<Patient>>({})

  // Odontogram state
  const [teeth, setTeeth]         = useState<Record<number, ToothRecord>>({})
  const [savingTooth, setSavingTooth] = useState<number | null>(null)
  const [teethLoaded, setTeethLoaded] = useState(false)

  // Clinical records state
  const [records, setRecords]     = useState<ClinicalRecord[]>([])
  const [recordsLoaded, setRecordsLoaded] = useState(false)
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)
  const [showAddRecord, setShowAddRecord]   = useState(false)
  const [addRecordForm, setAddRecordForm]   = useState({
    session_date: new Date().toISOString().slice(0, 10),
    chief_complaint: '',
    diagnosis: '',
    notes: '',
  })
  const [savingRecord, setSavingRecord] = useState(false)

  // ── Odontogram ────────────────────────────────────────────
  const loadTeeth = useCallback(async () => {
    if (teethLoaded || !currentClinic || !patient) return
    const sb = createClient()
    const { data } = await sb
      .from('tooth_records')
      .select('*')
      .eq('patient_id', patient.id)
      .eq('clinic_id', currentClinic.id)
    if (data) {
      const map: Record<number, ToothRecord> = {}
      for (const r of data) map[r.tooth_number] = r as ToothRecord
      setTeeth(map)
    }
    setTeethLoaded(true)
  }, [teethLoaded, currentClinic, patient])

  useEffect(() => {
    if (tab === 'odontograma') loadTeeth()
  }, [tab, loadTeeth])

  // ── Clinical Records ──────────────────────────────────────
  const loadRecords = useCallback(async () => {
    if (recordsLoaded || !currentClinic || !patient) return
    const sb = createClient()
    const { data } = await sb
      .from('clinical_records')
      .select(`*, treatments:clinical_treatments(*)`)
      .eq('patient_id', patient.id)
      .eq('clinic_id', currentClinic.id)
      .order('session_date', { ascending: false })
    if (data) setRecords(data as ClinicalRecord[])
    setRecordsLoaded(true)
  }, [recordsLoaded, currentClinic, patient])

  useEffect(() => {
    if (tab === 'historial') loadRecords()
  }, [tab, loadRecords])

  if (!patient) return null

  const p        = patient
  const fullName = `${p.first_name} ${p.last_name}`
  const score    = computePatientScore(p.id, appointments)
  const comp     = getComplianceLabel(score.attendance_rate)
  const rfm      = score.rfm_segment ? getRfmConfig(score.rfm_segment) : null
  const churn    = score.churn_risk  ? getChurnConfig(score.churn_risk) : null
  const confirmed = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const patNps    = npsResponses.filter(n => n.patient_id === p.id)

  async function handleToothChange(toothNumber: number, condition: ToothCondition) {
    if (!currentClinic) return
    setSavingTooth(toothNumber)
    setTeeth(prev => ({ ...prev, [toothNumber]: { tooth_number: toothNumber, condition } }))
    const sb = createClient()
    await sb.from('tooth_records').upsert({
      patient_id: p.id,
      clinic_id: currentClinic.id,
      tooth_number: toothNumber,
      condition,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'patient_id,tooth_number' })
    setSavingTooth(null)
  }

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault()
    if (!currentClinic) return
    setSavingRecord(true)
    const sb = createClient()
    const { data } = await sb
      .from('clinical_records')
      .insert({
        patient_id: p.id,
        clinic_id: currentClinic.id,
        session_date: addRecordForm.session_date,
        chief_complaint: addRecordForm.chief_complaint || null,
        diagnosis: addRecordForm.diagnosis || null,
        notes: addRecordForm.notes || null,
      })
      .select(`*, treatments:clinical_treatments(*)`)
      .single()
    if (data) setRecords(prev => [data as ClinicalRecord, ...prev])
    setAddRecordForm({ session_date: new Date().toISOString().slice(0, 10), chief_complaint: '', diagnosis: '', notes: '' })
    setShowAddRecord(false)
    setSavingRecord(false)
  }

  async function handleDeleteRecord(id: string) {
    if (!confirm('¿Eliminar esta sesión clínica?')) return
    const sb = createClient()
    await sb.from('clinical_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  // ── Edit/Delete patient ───────────────────────────────────
  function startEdit() {
    setForm({ first_name: p.first_name, last_name: p.last_name ?? '', phone: p.phone ?? '', email: p.email ?? '', dni: p.dni ?? '', date_of_birth: p.date_of_birth ?? '', address: p.address ?? '', notes: p.notes ?? '' })
    setEditing(true)
    setConfirmDelete(false)
  }

  async function saveEdit() {
    if (!form.first_name) return
    setSaving(true)
    await onEdit?.(p.id, form)
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    setSaving(true)
    await onDelete?.(p.id)
    setSaving(false)
    setConfirmDelete(false)
    onClose()
  }

  const inputClass = cn(
    'w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)]',
    'bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
  )

  function handleClose() {
    setEditing(false)
    setConfirmDelete(false)
    onClose()
  }

  const modalSize = tab === 'odontograma' ? 'xl' : 'lg'

  const TABS: { id: PatientTab; label: string }[] = [
    { id: 'general',     label: 'General' },
    { id: 'odontograma', label: 'Examen Clínico' },
    { id: 'historial',   label: 'Historial Clínico' },
  ]

  return (
    <Modal open={!!patient} onClose={handleClose} size={editing ? 'lg' : modalSize} title={editing ? 'Editar paciente' : fullName}>
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Nombre *</label>
              <input className={inputClass} value={form.first_name ?? ''} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Apellido</label>
              <input className={inputClass} value={form.last_name ?? ''} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">DNI</label>
              <input className={inputClass} value={form.dni ?? ''} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Fecha de nacimiento</label>
              <input type="date" className={inputClass} value={form.date_of_birth ?? ''} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Dirección</label>
            <input className={inputClass} value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Notas / Alergias</label>
            <textarea rows={3} className={cn(inputClass, 'resize-none')} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={saveEdit} disabled={saving || !form.first_name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-60">
              <Check size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Patient header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar name={fullName} size="lg" />
              <div>
                <p className="text-[13px] text-[var(--subtle)]">{p.phone}{p.email ? ` · ${p.email}` : ''}</p>
                {p.date_of_birth && <p className="text-[11px] text-[var(--subtle)]">Nac: {formatDate(p.date_of_birth)}</p>}
                {p.dni && <p className="text-[11px] text-[var(--subtle)]">DNI: {p.dni}</p>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {onEdit && (
                <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">
                  <Pencil size={12} /> Editar
                </button>
              )}
              {onDelete && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-red-200 text-[12px] text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={12} /> Eliminar
                </button>
              )}
            </div>
          </div>

          {confirmDelete && (
            <div className="mb-4 px-4 py-3 rounded-[10px] bg-red-50 border border-red-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-[12px] text-red-700 font-medium">¿Dar de baja a {fullName}?</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 rounded-[8px] bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">{saving ? '...' : 'Confirmar'}</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[var(--border)] mb-5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors -mb-px',
                  tab === t.id
                    ? 'border-[var(--brand)] text-[var(--brand)]'
                    : 'border-transparent text-[var(--subtle)] hover:text-[var(--foreground)]'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── GENERAL tab ─────────────────────────────────── */}
          {tab === 'general' && (
            <>
              {p.notes && (
                <div className="mb-4 px-4 py-3 rounded-[10px] bg-[var(--warning-bg)] border border-amber-200">
                  <p className="text-[12px] text-amber-800 font-medium">⚠ {p.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Total turnos', value: appointments.length, color: '#6366f1', bg: '#eef2ff' },
                  { label: 'Asistidos',    value: confirmed,           color: '#10b981', bg: '#f0fdf4' },
                  { label: 'Cancelados',   value: cancelled,           color: '#ef4444', bg: '#fef2f2' },
                ].map(s => (
                  <div key={s.label} className="rounded-[10px] p-3 text-center" style={{ background: s.bg }}>
                    <p className="text-[22px] font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-[var(--subtle)] mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mb-5">
                <div className="flex justify-between text-[12px] mb-1.5">
                  <span className="font-semibold text-[var(--foreground)]">Índice de cumplimiento</span>
                  <span className="font-bold" style={{ color: comp.color }}>{Math.round(score.attendance_rate * 100)}% · {comp.label}</span>
                </div>
                <ProgressBar value={score.attendance_rate} color={comp.color} height={8} />
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {rfm && <span className="badge text-[11px]" style={{ background: rfm.bg, color: rfm.color }}>{rfm.label} · {rfm.description}</span>}
                {churn && score.churn_risk !== 'low' && <span className="badge text-[11px] bg-[var(--danger-bg)]" style={{ color: churn.color }}>Churn: {churn.label} ({formatPct(score.churn_probability ?? 0)})</span>}
                {score.recency_days !== null && <span className="badge text-[11px] bg-[var(--surface-2)] text-[var(--muted)]">Última visita: hace {score.recency_days}d</span>}
              </div>
              <div className="mb-5">
                <h4 className="text-[13px] font-semibold text-[var(--foreground)] mb-3">Historial de turnos</h4>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {appointments.length === 0
                    ? <p className="text-[12px] text-[var(--subtle)] text-center py-6">Sin turnos registrados</p>
                    : [...appointments].sort((a, b) => b.starts_at.localeCompare(a.starts_at)).map(a => <AppointmentRow key={a.id} appointment={a} showDate />)
                  }
                </div>
              </div>
              {patNps.length > 0 && (
                <div>
                  <h4 className="text-[13px] font-semibold text-[var(--foreground)] mb-3">Respuestas NPS</h4>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {patNps.map(n => (
                      <div key={n.id} className="flex items-start gap-3 p-3 rounded-[10px] bg-[var(--surface-2)]">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ background: n.score >= 9 ? '#10b981' : n.score >= 7 ? '#f59e0b' : '#ef4444' }}>{n.score}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-[var(--foreground)] leading-relaxed">&ldquo;{n.comment}&rdquo;</p>
                          <p className="text-[10px] text-[var(--subtle)] mt-1">{formatDate(n.created_at, 'dd/MM/yyyy')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── ODONTOGRAMA tab ──────────────────────────────── */}
          {tab === 'odontograma' && (
            <div>
              {!teethLoaded ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <Odontogram
                  patientId={p.id}
                  teeth={teeth}
                  onToothChange={handleToothChange}
                  saving={savingTooth}
                />
              )}
            </div>
          )}

          {/* ── HISTORIAL CLÍNICO tab ─────────────────────────── */}
          {tab === 'historial' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-[var(--subtle)]">{records.length} sesión{records.length !== 1 ? 'es' : ''} registrada{records.length !== 1 ? 's' : ''}</p>
                <button
                  onClick={() => setShowAddRecord(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12.5px] font-semibold hover:opacity-90 transition-opacity"
                >
                  <Plus size={13} /> Nueva sesión
                </button>
              </div>

              {/* Add record form */}
              {showAddRecord && (
                <form onSubmit={handleAddRecord} className="rounded-[10px] border border-[var(--brand)] bg-[var(--brand-subtle)] p-4 space-y-3">
                  <p className="text-[12.5px] font-semibold text-[var(--brand)]">Nueva sesión clínica</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Fecha *</label>
                      <input type="date" required value={addRecordForm.session_date} onChange={e => setAddRecordForm(f => ({ ...f, session_date: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Motivo de consulta</label>
                      <input value={addRecordForm.chief_complaint} onChange={e => setAddRecordForm(f => ({ ...f, chief_complaint: e.target.value }))} placeholder="Dolor molar superior..." className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Diagnóstico</label>
                    <input value={addRecordForm.diagnosis} onChange={e => setAddRecordForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="Caries clase II diente 16..." className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Notas clínicas</label>
                    <textarea rows={2} value={addRecordForm.notes} onChange={e => setAddRecordForm(f => ({ ...f, notes: e.target.value }))} placeholder="Evolución, indicaciones, próxima cita..." className={cn(inputClass, 'resize-none')} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowAddRecord(false)} className="px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
                    <button type="submit" disabled={savingRecord} className="px-4 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity">{savingRecord ? 'Guardando...' : 'Guardar sesión'}</button>
                  </div>
                </form>
              )}

              {/* Records list */}
              {!recordsLoaded ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-10">
                  <Stethoscope size={28} className="text-[var(--subtle)] mx-auto mb-2" />
                  <p className="text-[13px] text-[var(--subtle)]">Sin sesiones clínicas registradas.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {records.map(rec => {
                    const isExp = expandedRecord === rec.id
                    return (
                      <div key={rec.id} className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
                        <button
                          onClick={() => setExpandedRecord(isExp ? null : rec.id)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--brand-subtle)] flex items-center justify-center flex-shrink-0">
                              <Stethoscope size={14} className="text-[var(--brand)]" />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-[var(--foreground)]">
                                {new Date(rec.session_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </p>
                              {rec.chief_complaint && <p className="text-[11.5px] text-[var(--subtle)]">{rec.chief_complaint}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {(rec.treatments?.length ?? 0) > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-subtle)] text-[var(--brand)] font-medium">
                                {rec.treatments!.length} tratamiento{rec.treatments!.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteRecord(rec.id) }}
                              className="p-1 rounded text-[var(--subtle)] hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                            {isExp ? <ChevronUp size={14} className="text-[var(--subtle)]" /> : <ChevronDown size={14} className="text-[var(--subtle)]" />}
                          </div>
                        </button>

                        {isExp && (
                          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[var(--border)]">
                            {rec.diagnosis && (
                              <div>
                                <p className="text-[10px] text-[var(--subtle)] uppercase tracking-wider font-medium mb-1">Diagnóstico</p>
                                <p className="text-[12.5px] text-[var(--foreground)]">{rec.diagnosis}</p>
                              </div>
                            )}
                            {rec.notes && (
                              <div>
                                <p className="text-[10px] text-[var(--subtle)] uppercase tracking-wider font-medium mb-1">Notas</p>
                                <p className="text-[12.5px] text-[var(--foreground)] whitespace-pre-wrap">{rec.notes}</p>
                              </div>
                            )}
                            {rec.treatments && rec.treatments.length > 0 && (
                              <div>
                                <p className="text-[10px] text-[var(--subtle)] uppercase tracking-wider font-medium mb-2">Tratamientos</p>
                                <div className="space-y-1.5">
                                  {rec.treatments.map(t => (
                                    <div key={t.id} className="flex items-center justify-between px-3 py-1.5 rounded-[8px] bg-[var(--surface)]">
                                      <div className="flex items-center gap-2">
                                        {t.tooth_number && <span className="text-[10px] font-bold text-[var(--brand)] bg-[var(--brand-subtle)] px-1.5 rounded">#{t.tooth_number}</span>}
                                        <span className="text-[12px] text-[var(--foreground)]">{t.description ?? '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {t.amount != null && <span className="text-[11px] text-[var(--muted)]">${t.amount.toLocaleString()}</span>}
                                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', TREATMENT_STATUS_COLOR[t.status])}>{TREATMENT_STATUS_LABEL[t.status]}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
