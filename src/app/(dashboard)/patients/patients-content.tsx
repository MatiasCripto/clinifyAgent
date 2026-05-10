'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { PatientCard } from '@/components/patients/patient-card'
import { PatientDetail } from '@/components/patients/patient-detail'
import { Modal } from '@/components/ui/modal'
import { StatCard } from '@/components/ui/stat-card'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import type { Patient, Appointment } from '@/lib/types'
import { Users, TrendingDown, AlertTriangle, Star } from 'lucide-react'

type RfmFilter = 'all' | 'champion' | 'loyal' | 'at_risk' | 'new' | 'dormant' | 'lost'

const RFM_FILTERS: { key: RfmFilter; label: string }[] = [
  { key: 'all',      label: 'Todos'      },
  { key: 'champion', label: 'Campeones'  },
  { key: 'loyal',    label: 'Leales'     },
  { key: 'at_risk',  label: 'En riesgo'  },
  { key: 'new',      label: 'Nuevos'     },
  { key: 'dormant',  label: 'Dormidos'   },
  { key: 'lost',     label: 'Perdidos'   },
]

export function PatientsContent() {
  const { authUser } = useAuth()
  const [search,       setSearch]       = useState('')
  const [rfmFilt,      setRfmFilt]      = useState<RfmFilter>('all')
  const [selected,     setSelected]     = useState<Patient | null>(null)
  const [addOpen,      setAddOpen]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [patients,     setPatients]     = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [newPat, setNewPat] = useState({ firstName: '', lastName: '', phone: '', email: '', notes: '' })

  useEffect(() => {
    const sb = createClient()
    sb.from('patients').select('*').eq('is_active', true).order('last_name')
      .then(({ data }) => setPatients((data as Patient[]) ?? []))
    sb.from('appointments').select('*, patient:patients(*), professional:professionals(*)')
      .then(({ data }) => setAppointments((data as Appointment[]) ?? []))
  }, [])

  const patientAppts = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    appointments.forEach(a => {
      if (!map[a.patient_id]) map[a.patient_id] = []
      map[a.patient_id].push(a)
    })
    return map
  }, [appointments])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return patients.filter(p => {
      const matchSearch = !q ||
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q)  ||
        (p.phone ?? '').includes(q) ||
        (p.email ?? '').toLowerCase().includes(q)
      return matchSearch
    })
  }, [search, patients])

  const nextAppt = (pid: string) =>
    (patientAppts[pid] ?? [])
      .filter(a => a.starts_at >= new Date().toISOString() && a.status !== 'cancelled')
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]

  async function handleAdd() {
    if (!newPat.firstName || !newPat.phone) return
    setSaving(true)
    const sb = createClient()
    const orgId = authUser?.organization?.id
    if (!orgId) { setSaving(false); return }
    const { data } = await sb.from('patients').insert({
      organization_id: orgId,
      first_name: newPat.firstName,
      last_name:  newPat.lastName || '',
      phone:      newPat.phone,
      email:      newPat.email || null,
      notes:      newPat.notes || null,
      is_active:  true,
    }).select().single()
    if (data) setPatients(prev => [...prev, data as Patient])
    setSaving(false)
    setAddOpen(false)
    setNewPat({ firstName: '', lastName: '', phone: '', email: '', notes: '' })
  }

  async function handleEdit(id: string, updated: Partial<Patient>) {
    const sb = createClient()
    const { data } = await sb.from('patients')
      .update({
        first_name:    updated.first_name,
        last_name:     updated.last_name,
        phone:         updated.phone || null,
        email:         updated.email || null,
        dni:           updated.dni || null,
        date_of_birth: updated.date_of_birth || null,
        address:       updated.address || null,
        notes:         updated.notes || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (data) {
      setPatients(prev => prev.map(p => p.id === id ? { ...p, ...(data as Patient) } : p))
      setSelected(data as Patient)
    }
  }

  async function handleDelete(id: string) {
    const sb = createClient()
    await sb.from('patients').update({ is_active: false }).eq('id', id)
    setPatients(prev => prev.filter(p => p.id !== id))
    setSelected(null)
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Pacientes</h1>
          <p className="text-[13px] text-[var(--subtle)] mt-0.5">{patients.length} pacientes registrados</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors"
        >
          <UserPlus size={15} /> Agregar paciente
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total pacientes" value={patients.length} icon={Users}         iconColor="#6366f1" />
        <StatCard label="Campeones"        value={0}              icon={Star}           iconColor="#10b981" />
        <StatCard label="En riesgo"        value={0}              icon={AlertTriangle}  iconColor="#f59e0b" />
        <StatCard label="Perdidos"         value={0}              icon={TrendingDown}   iconColor="#ef4444" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="xl:col-span-1">
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wider mb-3">Segmento RFM</p>
            <div className="space-y-1">
              {RFM_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setRfmFilt(f.key)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-[8px] text-[12.5px] font-medium transition-colors',
                    rfmFilt === f.key
                      ? 'bg-[var(--brand-subtle)] text-[var(--brand)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-2)]'
                  )}
                >
                  {f.label}
                  <span className="float-right text-[11px] text-[var(--subtle)]">
                    {f.key === 'all' ? patients.length : 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
            <input
              type="search"
              placeholder="Buscar por nombre, teléfono o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(
                'w-full pl-9 pr-4 py-2.5 text-[13px] rounded-[10px]',
                'bg-[var(--surface)] border border-[var(--border)]',
                'text-[var(--foreground)] placeholder:text-[var(--subtle)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
              )}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="card p-12 text-center text-[var(--subtle)] text-[13px]">Sin resultados</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(p => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  appointments={patientAppts[p.id] ?? []}
                  nextAppointment={nextAppt(p.id)}
                  onClick={() => setSelected(p)}
                />
              ))}
            </div>
          )}
          <p className="text-[11px] text-[var(--subtle)] text-right">{filtered.length} paciente{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <PatientDetail
        patient={selected}
        appointments={selected ? (patientAppts[selected.id] ?? []) : []}
        npsResponses={[]}
        onClose={() => setSelected(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Agregar paciente" size="sm">
        <div className="space-y-4">
          {[
            { id: 'fn', label: 'Nombre *',   key: 'firstName', placeholder: 'Ana' },
            { id: 'ln', label: 'Apellido *',  key: 'lastName',  placeholder: 'García' },
            { id: 'ph', label: 'Teléfono *',  key: 'phone',     placeholder: '351-xxxx-xxx' },
            { id: 'em', label: 'Email',       key: 'email',     placeholder: 'email@gmail.com' },
            { id: 'nt', label: 'Notas',       key: 'notes',     placeholder: 'Alergias, observaciones...' },
          ].map(f => (
            <div key={f.id}>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">{f.label}</label>
              <input
                className={cn(
                  'w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)]',
                  'bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
                )}
                placeholder={f.placeholder}
                value={newPat[f.key as keyof typeof newPat]}
                onChange={e => setNewPat(v => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : '+ Agregar paciente'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
