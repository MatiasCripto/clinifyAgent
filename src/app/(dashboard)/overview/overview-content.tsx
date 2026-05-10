'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { motion, type Variants, type Easing } from 'framer-motion'
import {
  CalendarDays, Users, MessageSquare, TrendingUp,
  Clock, CheckCircle2, XCircle, ArrowRight,
  Plus, Pencil, Trash2, DollarSign, AlertCircle,
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { NpsGauge } from '@/components/ui/nps-gauge'
import { AppointmentRow } from '@/components/dashboard/appointment-row'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import { cn } from '@/lib/utils/cn'
import type { Appointment, Service } from '@/lib/types'

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.25, ease: 'easeOut' as Easing }
  }),
}

const EMPTY_SERVICE = { name: '', description: '', price: '' }

function ServicesCard() {
  const { authUser } = useAuth()
  const [services, setServices]     = useState<Service[]>([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected]     = useState<Service | null>(null)
  const [form, setForm]             = useState(EMPTY_SERVICE)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)

  const orgId = authUser?.profile?.organization_id

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const sb = createClient()
    const { data } = await sb
      .from('services')
      .select('*')
      .eq('organization_id', orgId)
      .order('name', { ascending: true })
    setServices((data as Service[]) ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setForm(EMPTY_SERVICE); setError(null); setModal('create')
  }

  function openEdit(s: Service) {
    setSelected(s)
    setForm({ name: s.name, description: s.description ?? '', price: String(s.price) })
    setError(null); setModal('edit')
  }

  function closeModal() { setModal(null); setSelected(null); setError(null) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    const price = parseFloat(form.price)
    if (isNaN(price) || price < 0) { setError('Precio inválido'); return }

    setSaving(true); setError(null)
    const sb = createClient()

    if (modal === 'create') {
      const { error: err } = await sb.from('services').insert({
        organization_id: orgId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        is_active: true,
      })
      if (err) { setError(err.message); setSaving(false); return }
    } else if (modal === 'edit' && selected) {
      const { error: err } = await sb.from('services').update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
      }).eq('id', selected.id)
      if (err) { setError(err.message); setSaving(false); return }
    }

    closeModal()
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const sb = createClient()
    await sb.from('services').delete().eq('id', id)
    setDeleteId(null)
    setServices(prev => prev.filter(s => s.id !== id))
  }

  async function toggleActive(s: Service) {
    const sb = createClient()
    await sb.from('services').update({ is_active: !s.is_active }).eq('id', s.id)
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !s.is_active } : x))
  }

  const activeCount = services.filter(s => s.is_active).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.25 }}
    >
      <div className="card p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] bg-emerald-100 flex items-center justify-center">
              <DollarSign size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Servicios y Precios</h2>
              <p className="text-[11px] text-[var(--subtle)]">{activeCount} activo{activeCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--brand)] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={13} /> Agregar
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-10 text-[13px] text-[var(--subtle)]">
            <DollarSign size={28} className="mx-auto mb-2 opacity-30" />
            No hay servicios todavía. Agregá el primero.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-5 py-2 text-[11px] font-medium text-[var(--subtle)]">Servicio</th>
                  <th className="text-left px-4 py-2 text-[11px] font-medium text-[var(--subtle)] hidden sm:table-cell">Descripción</th>
                  <th className="text-right px-4 py-2 text-[11px] font-medium text-[var(--subtle)]">Precio</th>
                  <th className="text-center px-4 py-2 text-[11px] font-medium text-[var(--subtle)]">Estado</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {services.map(s => (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--foreground)]">{s.name}</td>
                    <td className="px-4 py-3 text-[var(--subtle)] hidden sm:table-cell">{s.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      ${Number(s.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(s)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                          s.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        )}
                      >
                        {s.is_active ? '● Activo' : '○ Inactivo'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-[6px] text-[var(--subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="p-1.5 rounded-[6px] text-[var(--subtle)] hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[420px] shadow-2xl">
            <div className="p-5 border-b border-[var(--border)]">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
                {modal === 'create' ? 'Agregar servicio' : 'Editar servicio'}
              </h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-[10px] bg-red-50 border border-red-100 text-red-700 text-[12px]">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Nombre *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Arreglo de caries"
                  required
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Descripción</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descripción opcional"
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-medium text-[var(--foreground)]">Precio *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)] text-[13px]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    required
                    className="w-full pl-7 pr-3 py-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                  {saving ? 'Guardando...' : modal === 'create' ? 'Agregar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-[340px] shadow-2xl p-5">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)] mb-2">Eliminar servicio</h2>
            <p className="text-[13px] text-[var(--muted)] mb-5">¿Estás seguro? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-[10px] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 rounded-[10px] bg-red-500 text-white text-[13px] font-semibold hover:opacity-90 transition-opacity">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export function OverviewContent() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patientCount, setPatientCount] = useState(0)
  const [professionalCount, setProfessionalCount] = useState(0)

  useEffect(() => {
    const sb = createClient()
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999)

    sb.from('appointments')
      .select('*, patient:patients(*), professional:professionals(*)')
      .gte('starts_at', todayStart.toISOString())
      .lte('starts_at', todayEnd.toISOString())
      .order('starts_at', { ascending: true })
      .then(({ data }) => setAppointments((data as Appointment[]) ?? []))

    sb.from('patients').select('id', { count: 'exact', head: true })
      .then(({ count }) => setPatientCount(count ?? 0))

    sb.from('professionals').select('id', { count: 'exact', head: true }).eq('is_active', true)
      .then(({ count }) => setProfessionalCount(count ?? 0))
  }, [])

  const confirmed = useMemo(() => appointments.filter(a => a.status === 'confirmed').length, [appointments])
  const pending   = useMemo(() => appointments.filter(a => a.status === 'pending').length,   [appointments])
  const cancelled = useMemo(() => appointments.filter(a => a.status === 'cancelled').length, [appointments])

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Panel principal</h1>
        <p className="text-[13px] text-[var(--subtle)] mt-0.5">Resumen del día</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Turnos hoy',  value: appointments.length, sub: `${confirmed} confirmados · ${pending} pendientes`, icon: CalendarDays, iconColor: '#6366f1', i: 0 },
          { label: 'Pacientes',   value: patientCount,         sub: `${professionalCount} profesionales activos`,       icon: Users,        iconColor: '#10b981', i: 1 },
          { label: 'Mensajes WA', value: 0,                    sub: 'Últimos 45 días',                                  icon: MessageSquare, iconColor: '#6366f1', i: 2 },
          { label: 'NPS Score',   value: 0,                    sub: 'Sin datos',                                        icon: TrendingUp,   iconColor: '#6366f1', i: 3 },
        ].map((kpi) => (
          <motion.div key={kpi.label} custom={kpi.i} initial="hidden" animate="visible" variants={fadeUp}>
            <StatCard label={kpi.label} value={kpi.value} sub={kpi.sub} icon={kpi.icon} iconColor={kpi.iconColor} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <motion.div className="xl:col-span-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.25 }}>
          <div className="card p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Turnos de hoy</h2>
              <div className="flex items-center gap-2">
                <StatusPill color="#10b981" label={`${confirmed} confirmados`} />
                <StatusPill color="#f59e0b" label={`${pending} pendientes`} />
                <StatusPill color="#ef4444" label={`${cancelled} cancelados`} />
              </div>
            </div>
            <div className="space-y-2">
              {appointments.length === 0 ? (
                <p className="text-center py-12 text-[13px] text-[var(--subtle)]">Sin turnos hoy</p>
              ) : (
                appointments.slice(0, 7).map(appt => <AppointmentRow key={appt.id} appointment={appt} />)
              )}
            </div>
            {appointments.length > 7 && (
              <div className="mt-3 text-center">
                <Link href="/appointments" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--brand)] hover:underline">
                  Ver todos los turnos <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="flex flex-col gap-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.25 }}>
          <div className="card p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Net Promoter Score</h2>
              <Link href="/analytics" className="text-[11px] text-[var(--brand)] hover:underline flex items-center gap-1">
                Detalle <ArrowRight size={11} />
              </Link>
            </div>
            <NpsGauge score={0} promoters={0} neutrals={0} detractors={0} total={0} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <QuickStat icon={CheckCircle2} label="Confirmados" value={confirmed} color="#10b981" />
            <QuickStat icon={Clock}        label="Pendientes"  value={pending}   color="#f59e0b" />
            <QuickStat icon={XCircle}      label="Cancelados"  value={cancelled} color="#ef4444" />
          </div>
        </motion.div>
      </div>

      <ServicesCard />
    </div>
  )
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </div>
  )
}

function QuickStat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="card p-3 text-center">
      <Icon size={18} className="mx-auto mb-1.5" style={{ color }} />
      <div className="text-[20px] font-bold text-[var(--foreground)] leading-none">{value}</div>
      <div className="text-[10px] text-[var(--subtle)] mt-1 leading-tight">{label}</div>
    </div>
  )
}
