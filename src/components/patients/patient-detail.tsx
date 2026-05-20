'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Avatar } from '@/components/ui/avatar'
import { ProgressBar } from '@/components/ui/progress-bar'
import { AppointmentRow } from '@/components/dashboard/appointment-row'
import { computePatientScore } from '@/lib/utils/patient-scores'
import { getComplianceLabel, getRfmConfig, getChurnConfig, formatDate, formatPct } from '@/lib/utils/formatters'
import type { Patient, Appointment, NpsResponse } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { Pencil, Trash2, Check, AlertTriangle, Plus, Upload, FileText, Image, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'

type PatientTab = 'general' | 'historial'

interface ClinicalSession {
  id: string
  patient_id: string
  professional_id: string | null
  appointment_id: string | null
  organization_id: string
  date: string
  area: string | null
  specialty: string | null
  notes: string | null
  created_at: string
  professionals?: { full_name: string } | null
}

interface Professional {
  id: string
  full_name: string
}

interface PatientDocument {
  id: string
  patient_id: string
  organization_id: string
  file_url: string
  file_name: string
  file_type: string
  uploaded_by: string
  uploaded_at: string
  deleted_by: string | null
  deleted_at: string | null
  is_deleted: boolean
  uploaded_by_profile?: { full_name: string } | null
}

function isImage(type: string) { return type.startsWith('image/') }

function fileIcon(type: string) {
  if (type.startsWith('image/')) return Image
  return FileText
}

interface PatientDetailProps {
  patient: Patient | null
  appointments: Appointment[]
  npsResponses: NpsResponse[]
  onClose: () => void
  onEdit?: (id: string, updated: Partial<Patient>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function PatientDetail({ patient, appointments, npsResponses, onClose, onEdit, onDelete }: PatientDetailProps) {
  const { currentClinic, authUser } = useAuth()
  const [tab, setTab]             = useState<PatientTab>('general')
  const [editing, setEditing]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState<Partial<Patient>>({})

  // Clinical sessions state
  const [sessions, setSessions]         = useState<ClinicalSession[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [showAddSession, setShowAddSession]   = useState(false)
  const [addSessionForm, setAddSessionForm]   = useState({
    date: new Date().toISOString().slice(0, 10),
    professional_id: '',
    specialty: '',
    area: '',
    notes: '',
  })
  const [savingSession, setSavingSession] = useState(false)

  // Documents state
  const [documents, setDocuments]             = useState<PatientDocument[]>([])
  const [docsLoaded, setDocsLoaded]           = useState(false)
  const [uploadingDoc, setUploadingDoc]       = useState(false)
  const [deletingDoc, setDeletingDoc]         = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Professionals state (for dropdown)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [prosLoaded, setProsLoaded] = useState(false)

  // ── Load professionals ─────────────────────────────────────
  const loadProfessionals = useCallback(async () => {
    if (prosLoaded || !currentClinic) return
    const sb = createClient()
    const { data } = await sb
      .from('professionals')
      .select('id, full_name')
      .eq('organization_id', currentClinic.organization_id)
      .order('full_name')
    if (data) setProfessionals(data as Professional[])
    setProsLoaded(true)
  }, [prosLoaded, currentClinic])

  useEffect(() => {
    if (tab === 'historial') loadProfessionals()
  }, [tab, loadProfessionals])

  // ── Load clinical sessions ─────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (sessionsLoaded || !currentClinic || !patient) return
    const sb = createClient()
    const { data } = await sb
      .from('clinical_sessions')
      .select('*, professionals(full_name)')
      .eq('patient_id', patient.id)
      .eq('organization_id', currentClinic.organization_id)
      .order('date', { ascending: false })
    if (data) setSessions(data as ClinicalSession[])
    setSessionsLoaded(true)
  }, [sessionsLoaded, currentClinic, patient])

  useEffect(() => {
    if (tab === 'historial') loadSessions()
  }, [tab, loadSessions])


  const p        = patient
  const fullName = p ? `${p.first_name} ${p.last_name}` : ''
  const score    = p ? computePatientScore(p.id, appointments) : { attendance_rate: 0, rfm_segment: null, churn_risk: null, churn_probability: null, recency_days: null }
  const comp     = getComplianceLabel(score.attendance_rate)
  const rfm      = score.rfm_segment ? getRfmConfig(score.rfm_segment) : null
  const churn    = score.churn_risk  ? getChurnConfig(score.churn_risk) : null
  const confirmed = p ? appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length : 0
  const cancelled = p ? appointments.filter(a => a.status === 'cancelled').length : 0
  const patNps    = p ? npsResponses.filter(n => n.patient_id === p.id) : []

  async function handleAddSession(e: React.FormEvent) {
    e.preventDefault()
    if (!currentClinic || !p) return
    setSavingSession(true)
    const sb = createClient()
    const { data } = await sb
      .from('clinical_sessions')
      .insert({
        patient_id: p.id,
        organization_id: currentClinic.organization_id,
        professional_id: addSessionForm.professional_id || null,
        date: addSessionForm.date,
        specialty: addSessionForm.specialty || null,
        area: addSessionForm.area || null,
        notes: addSessionForm.notes || null,
      })
      .select('*, professionals(full_name)')
      .single()
    if (data) setSessions(prev => [data as ClinicalSession, ...prev])
    setAddSessionForm({ date: new Date().toISOString().slice(0, 10), professional_id: '', specialty: '', area: '', notes: '' })
    setShowAddSession(false)
    setSavingSession(false)
  }

  async function handleDeleteSession(id: string) {
    if (!confirm('¿Eliminar esta sesion clinica?')) return
    const sb = createClient()
    await sb.from('clinical_sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  // ── Documents ────────────────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    if (docsLoaded || !currentClinic || !patient) return
    const sb = createClient()
    const { data } = await sb
      .from('patient_documents')
      .select('*, uploaded_by_profile:profiles!uploaded_by(full_name)')
      .eq('patient_id', patient.id)
      .eq('organization_id', currentClinic.organization_id)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: false })
    if (data) setDocuments(data as PatientDocument[])
    setDocsLoaded(true)
  }, [docsLoaded, currentClinic, patient])

  useEffect(() => {
    if (tab === 'historial') loadDocuments()
  }, [tab, loadDocuments])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentClinic || !p) return
    setUploadingDoc(true)
    const sb = createClient()
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `patient-documents/${currentClinic.organization_id}/${p.id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await sb.storage
      .from('patient-documents')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (uploadError) { alert(uploadError.message); setUploadingDoc(false); return }

    const { data: { publicUrl } } = sb.storage.from('patient-documents').getPublicUrl(path)

    const { data, error: insertError } = await sb
      .from('patient_documents')
      .insert({
        patient_id: p.id,
        organization_id: currentClinic.organization_id,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        uploaded_by: authUser?.profile?.id,
        uploaded_at: new Date().toISOString(),
      })
      .select('*, uploaded_by_profile:profiles!uploaded_by(full_name)')
      .single()

    if (insertError) { alert(insertError.message); setUploadingDoc(false); return }
    if (data) setDocuments(prev => [data as PatientDocument, ...prev])

    // reset file input
    if (fileRef.current) fileRef.current.value = ''
    setUploadingDoc(false)
  }

  async function handleDeleteDocument(docId: string) {
    if (!confirm('¿Eliminar este documento?')) return
    setDeletingDoc(docId)
    const sb = createClient()
    await sb
      .from('patient_documents')
      .update({
        is_deleted: true,
        deleted_by: authUser?.profile?.id,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', docId)
    setDocuments(prev => prev.filter(d => d.id !== docId))
    setDeletingDoc(null)
  }

  // ── Edit/Delete patient ───────────────────────────────────
  function startEdit() {
    if (!p) return
    setForm({ first_name: p.first_name, last_name: p.last_name ?? '', phone: p.phone ?? '', email: p.email ?? '', dni: p.dni ?? '', date_of_birth: p.date_of_birth ?? '', address: p.address ?? '', notes: p.notes ?? '' })
    setEditing(true)
    setConfirmDelete(false)
  }

  async function saveEdit() {
    if (!p || !form.first_name) return
    setSaving(true)
    await onEdit?.(p.id, form)
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    if (!p) return
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

  const TABS: { id: PatientTab; label: string }[] = [
    { id: 'general',   label: 'General' },
    { id: 'historial', label: 'Historial Clinico' },
  ]

  return (
    <Modal open={!!patient} onClose={handleClose} size="lg" title={editing ? 'Editar paciente' : (fullName || '')}>
      {patient && editing ? (
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
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Telefono</label>
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
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Direccion</label>
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
      ) : patient ? (
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
                  <span className="font-semibold text-[var(--foreground)]">Indice de cumplimiento</span>
                  <span className="font-bold" style={{ color: comp.color }}>{Math.round(score.attendance_rate * 100)}% · {comp.label}</span>
                </div>
                <ProgressBar value={score.attendance_rate} color={comp.color} height={8} />
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {rfm && <span className="badge text-[11px]" style={{ background: rfm.bg, color: rfm.color }}>{rfm.label} · {rfm.description}</span>}
                {churn && score.churn_risk !== 'low' && <span className="badge text-[11px] bg-[var(--danger-bg)]" style={{ color: churn.color }}>Churn: {churn.label} ({formatPct(score.churn_probability ?? 0)})</span>}
                {score.recency_days !== null && <span className="badge text-[11px] bg-[var(--surface-2)] text-[var(--muted)]">Ultima visita: hace {score.recency_days}d</span>}
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

          {/* ── HISTORIAL CLINICO tab ────────────────────────── */}
          {tab === 'historial' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-[var(--subtle)]">{sessions.length} sesion{sessions.length !== 1 ? 'es' : ''} registrada{sessions.length !== 1 ? 's' : ''}</p>
                <button
                  onClick={() => setShowAddSession(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12.5px] font-semibold hover:opacity-90 transition-opacity"
                >
                  <Plus size={13} /> Nueva sesion
                </button>
              </div>

              {/* Add session form */}
              {showAddSession && (
                <form onSubmit={handleAddSession} className="rounded-[10px] border border-[var(--brand)] bg-[var(--brand-subtle)] p-4 space-y-3">
                  <p className="text-[12.5px] font-semibold text-[var(--brand)]">Nueva sesion clinica</p>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Fecha *</label>
                    <input type="date" required value={addSessionForm.date} onChange={e => setAddSessionForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Profesional</label>
                    <select
                      value={addSessionForm.professional_id}
                      onChange={e => setAddSessionForm(f => ({ ...f, professional_id: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Seleccionar profesional...</option>
                      {professionals.map(pro => (
                        <option key={pro.id} value={pro.id}>{pro.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Especialidad</label>
                      <input value={addSessionForm.specialty} onChange={e => setAddSessionForm(f => ({ ...f, specialty: e.target.value }))} placeholder="Ej: Ortodoncia..." className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Area</label>
                      <input value={addSessionForm.area} onChange={e => setAddSessionForm(f => ({ ...f, area: e.target.value }))} placeholder="Ej: Superior derecha..." className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--subtle)] mb-1">Notas</label>
                    <textarea rows={3} value={addSessionForm.notes} onChange={e => setAddSessionForm(f => ({ ...f, notes: e.target.value }))} placeholder="Evolucion, indicaciones, proxima cita..." className={cn(inputClass, 'resize-none')} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowAddSession(false)} className="px-3 py-1.5 rounded-[8px] border border-[var(--border)] text-[12px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
                    <button type="submit" disabled={savingSession} className="px-4 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity">{savingSession ? 'Guardando...' : 'Guardar sesion'}</button>
                  </div>
                </form>
              )}

              {/* Sessions list */}
              {!sessionsLoaded ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-[13px] text-[var(--subtle)]">Sin sesiones clinicas registradas.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {sessions.map(s => (
                    <div key={s.id} className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--foreground)]">
                            {new Date(s.date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                          {s.professionals?.full_name && (
                            <p className="text-[11.5px] text-[var(--brand)] mt-0.5">Dr/a. {s.professionals.full_name}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            {s.specialty && <span className="text-[11.5px] text-[var(--subtle)]">{s.specialty}</span>}
                            {s.area && <span className="text-[11.5px] text-[var(--subtle)]">{s.area}</span>}
                          </div>
                          {s.notes && (
                            <p className="text-[12px] text-[var(--foreground)] mt-2 whitespace-pre-wrap leading-relaxed">{s.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          className="p-1.5 rounded text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Documents section ──────────────────────────── */}
              <div className="mt-6 pt-5 border-t border-[var(--border)]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">Documentos</p>
                    <p className="text-[11px] text-[var(--subtle)] mt-0.5">
                      {documents.length} archivo{documents.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleUpload}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingDoc}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      <Upload size={12} />
                      {uploadingDoc ? 'Subiendo...' : 'Subir archivo'}
                    </button>
                  </div>
                </div>

                {!docsLoaded ? (
                  <div className="flex justify-center py-6">
                    <div className="w-4 h-4 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-6 rounded-[10px] border border-dashed border-[var(--border)]">
                    <p className="text-[12px] text-[var(--subtle)]">Sin documentos. Subí imagenes, PDFs o radiografias.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {documents.map(doc => {
                      const Icon = fileIcon(doc.file_type)
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors group"
                        >
                          {isImage(doc.file_type) ? (
                            <a href={doc.file_url} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-[8px] bg-gray-100 flex-shrink-0 overflow-hidden">
                              <img src={doc.file_url} alt={doc.file_name} className="w-full h-full object-cover" />
                            </a>
                          ) : (
                            <div className="w-10 h-10 rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
                              <Icon size={18} className="text-[var(--subtle)]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-[var(--foreground)] truncate">{doc.file_name}</p>
                            <p className="text-[10px] text-[var(--subtle)] mt-0.5">
                              {new Date(doc.uploaded_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                              {doc.uploaded_by_profile?.full_name && <> · {doc.uploaded_by_profile.full_name}</>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-[6px] text-[var(--subtle)] hover:text-[var(--brand)] hover:bg-[var(--brand-subtle)] transition-colors"
                              title="Abrir"
                            >
                              <Eye size={12} />
                            </a>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              disabled={deletingDoc === doc.id}
                              className="p-1.5 rounded-[6px] text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}
    </Modal>
  )
}
