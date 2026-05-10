'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, UserPlus, Tags, Plus, X, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ProfessionalCard } from '@/components/professionals/professional-card'
import { ProfessionalDetail } from '@/components/professionals/professional-detail'
import { Modal } from '@/components/ui/modal'
import { StatCard } from '@/components/ui/stat-card'
import { PlanLimitBanner } from '@/components/ui/plan-limit-banner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { usePlan } from '@/lib/plans/use-plan'
import { Stethoscope, CalendarDays, CheckCircle2, Users } from 'lucide-react'
import type { Professional, Specialty, Appointment } from '@/lib/types'

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316']
const SPECIALTY_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316']

export function ProfessionalsContent() {
  const { authUser } = useAuth()
  const { canAddProfessional, upgradeLabel, limits } = usePlan()
  const [search,        setSearch]        = useState('')
  const [selected,      setSelected]      = useState<Professional | null>(null)
  const [addOpen,       setAddOpen]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [specialties,   setSpecialties]   = useState<Specialty[]>([])
  const [appointments,  setAppointments]  = useState<Appointment[]>([])
  const [newProf, setNewProf] = useState({ name: '', specialtyId: '', phone: '', email: '' })
  const [specOpen,      setSpecOpen]      = useState(false)
  const [newSpecName,   setNewSpecName]   = useState('')
  const [savingSpec,    setSavingSpec]    = useState(false)

  useEffect(() => {
    fetch('/api/settings/professionals').then(r => r.ok ? r.json() : []).then(data => setProfessionals(data ?? []))
    fetch('/api/settings/specialties').then(r => r.ok ? r.json() : []).then(data => setSpecialties(data ?? []))
    const sb = createClient()
    sb.from('appointments').select('*, patient:patients(*), professional:professionals(*)')
      .then(({ data }) => setAppointments((data as Appointment[]) ?? []))
  }, [])

  const profAppts = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    appointments.forEach(a => {
      if (!map[a.professional_id]) map[a.professional_id] = []
      map[a.professional_id].push(a)
    })
    return map
  }, [appointments])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? professionals : professionals.filter(d =>
      d.full_name.toLowerCase().includes(q) ||
      ((d.specialty as Specialty | undefined)?.name ?? '').toLowerCase().includes(q)
    )
  }, [search, professionals])

  const totalConfirmed = useMemo(() => appointments.filter(a => a.status === 'confirmed').length, [appointments])
  const totalPatients  = useMemo(() => new Set(appointments.map(a => a.patient_id)).size, [appointments])

  async function handleAdd() {
    if (!newProf.name) return
    setSaving(true)
    const color = COLORS[professionals.length % COLORS.length]
    const res = await fetch('/api/settings/professionals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: newProf.name,
        specialty_id: newProf.specialtyId || null,
        phone: newProf.phone || null,
        email: newProf.email || null,
        color,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setProfessionals(prev => [...prev, data as Professional])
    }
    setSaving(false)
    setAddOpen(false)
    setNewProf({ name: '', specialtyId: '', phone: '', email: '' })
  }

  async function handleEdit(id: string, updated: Partial<Professional & { specialty_id: string | null }>) {
    const res = await fetch('/api/settings/professionals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        full_name:      updated.full_name,
        specialty_id:   updated.specialty_id || null,
        phone:          updated.phone || null,
        email:          updated.email || null,
        bio:            updated.bio || null,
        license_number: updated.license_number || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setProfessionals(prev => prev.map(p => p.id === id ? { ...p, ...(data as Professional) } : p))
      setSelected(data as Professional)
    }
  }

  async function handleDelete(id: string) {
    await fetch('/api/settings/professionals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setProfessionals(prev => prev.filter(p => p.id !== id))
    setSelected(null)
  }

  async function handleAddSpecialty() {
    const name = newSpecName.trim()
    if (!name) return
    setSavingSpec(true)
    const color = SPECIALTY_COLORS[specialties.length % SPECIALTY_COLORS.length]
    const res = await fetch('/api/settings/specialties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (res.ok) {
      const data = await res.json()
      setSpecialties(prev => [...prev, data as Specialty])
    }
    setNewSpecName('')
    setSavingSpec(false)
  }

  async function handleDeleteSpecialty(id: string) {
    await fetch('/api/settings/specialties', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSpecialties(prev => prev.filter(s => s.id !== id))
  }

  const inputClass = cn(
    'w-full px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)]',
    'bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
  )

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Profesionales</h1>
          <p className="text-[13px] text-[var(--subtle)] mt-0.5">{professionals.length} profesionales activos</p>
        </div>
        {canAddProfessional(professionals.length) ? (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors"
          >
            <UserPlus size={15} /> Agregar profesional
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-amber-300 bg-amber-50 text-amber-700 text-[13px] font-medium cursor-not-allowed" title={`Límite del plan: ${limits.professionals} profesional${limits.professionals !== 1 ? 'es' : ''}. Actualizá al plan ${upgradeLabel} para agregar más.`}>
            <Lock size={14} /> Límite alcanzado
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Profesionales"    value={professionals.length} icon={Stethoscope}  iconColor="#6366f1" />
        <StatCard label="Total turnos"     value={appointments.length}  icon={CalendarDays} iconColor="#10b981" />
        <StatCard label="Confirmados"      value={totalConfirmed}        icon={CheckCircle2} iconColor="#10b981" />
        <StatCard label="Pacientes únicos" value={totalPatients}         icon={Users}        iconColor="#8b5cf6" />
      </div>

      {/* Specialties manager */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setSpecOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Tags size={14} className="text-[var(--brand)]" />
            <span className="text-[13px] font-semibold text-[var(--foreground)]">Especialidades</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">{specialties.length}</span>
            {specialties.length === 0 && (
              <span className="text-[11px] text-amber-600 font-medium">— Agregá especialidades para que el bot las ofrezca</span>
            )}
          </div>
          {specOpen ? <ChevronUp size={14} className="text-[var(--subtle)]" /> : <ChevronDown size={14} className="text-[var(--subtle)]" />}
        </button>

        {specOpen && (
          <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {specialties.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-white" style={{ backgroundColor: s.color }}>
                  {s.name}
                  <button type="button" onClick={() => handleDeleteSpecialty(s.id)} className="ml-0.5 opacity-70 hover:opacity-100">
                    <X size={11} />
                  </button>
                </div>
              ))}
              {specialties.length === 0 && (
                <p className="text-[12px] text-[var(--subtle)]">Sin especialidades. Agregá las que ofrece tu clínica.</p>
              )}
            </div>
            <div className="flex gap-2 max-w-sm">
              <input
                value={newSpecName}
                onChange={e => setNewSpecName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSpecialty()}
                placeholder="Ej: Clínica General, Kinesiología..."
                className={cn(
                  'flex-1 px-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)]',
                  'bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--subtle)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-all'
                )}
              />
              <button
                type="button"
                onClick={handleAddSpecialty}
                disabled={savingSpec || !newSpecName.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Plus size={13} /> Agregar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
        <input
          type="search"
          placeholder="Buscar por nombre o especialidad..."
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-3 card p-12 text-center text-[var(--subtle)] text-[13px]">Sin profesionales</div>
        ) : (
          filtered.map(d => (
            <ProfessionalCard
              key={d.id}
              professional={d}
              appointments={profAppts[d.id] ?? []}
              onClick={() => setSelected(d)}
            />
          ))
        )}
      </div>

      <ProfessionalDetail
        professional={selected}
        appointments={selected ? (profAppts[selected.id] ?? []) : []}
        specialties={specialties}
        onClose={() => setSelected(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Agregar profesional" size="sm">
        <div className="space-y-4">
          {!canAddProfessional(professionals.length) && (
            <PlanLimitBanner
              feature="Límite de profesionales alcanzado"
              upgradeLabel={upgradeLabel}
              description={`Tu plan permite hasta ${limits.professionals} profesional${limits.professionals !== 1 ? 'es' : ''}.`}
            />
          )}
          {[
            { label: 'Nombre completo *', key: 'name',  placeholder: 'Dra. María López' },
            { label: 'Teléfono',          key: 'phone', placeholder: '351-xxxx-xxx' },
            { label: 'Email',             key: 'email', placeholder: 'email@clinica.com' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">{f.label}</label>
              <input
                className={inputClass}
                placeholder={f.placeholder}
                value={newProf[f.key as keyof typeof newProf]}
                onChange={e => setNewProf(v => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wide mb-1.5">Especialidad</label>
            <select
              className={inputClass}
              value={newProf.specialtyId}
              onChange={e => setNewProf(v => ({ ...v, specialtyId: e.target.value }))}
            >
              <option value="">Seleccionar...</option>
              {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full py-2.5 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : '+ Agregar profesional'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
