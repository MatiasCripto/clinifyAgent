'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { Plus, RefreshCw, Pencil, Trash2, CreditCard, AlertCircle } from 'lucide-react'

type SubStatus = 'active' | 'trial' | 'suspended' | 'cancelled'
type OrgPlan = 'starter' | 'pro' | 'enterprise'

interface Subscription {
  id: string
  organization_id: string
  plan: OrgPlan
  status: SubStatus
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  price_usd: number | null
  notes: string | null
  created_at: string
  updated_at: string
  organizations?: { id: string; name: string; plan: string }
}

interface OrgOption { id: string; name: string; plan: string }

const STATUS_STYLE: Record<SubStatus, string> = {
  active:    'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/20',
  trial:     'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
  suspended: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20',
  cancelled: 'bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-500/20',
}

const STATUS_LABEL: Record<SubStatus, string> = {
  active: 'Activo', trial: 'Trial', suspended: 'Suspendido', cancelled: 'Cancelado',
}

const PLAN_STYLE: Record<OrgPlan, string> = {
  starter:    'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300',
  pro:        'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
  enterprise: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function SAInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-[var(--subtle)]">{label}</label>}
      <input
        {...props}
        className={cn(
          'w-full px-3 py-2 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)]',
          'text-[13px] text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand)] transition-colors',
          props.className
        )}
      />
    </div>
  )
}

function SASelect({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-[var(--subtle)]">{label}</label>}
      <select
        {...props}
        className={cn(
          'w-full px-3 py-2 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)]',
          'text-[13px] text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)] transition-colors',
          props.className
        )}
      >
        {children}
      </select>
    </div>
  )
}

const EMPTY_FORM = {
  organization_id: '', plan: 'starter' as OrgPlan, status: 'active' as SubStatus,
  trial_ends_at: '', current_period_start: '', current_period_end: '',
  price_usd: '', notes: '',
}

export function SubscriptionsContent() {
  const [subs, setSubs]     = useState<Subscription[]>([])
  const [orgs, setOrgs]     = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<SubStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Subscription | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [subsRes, orgsRes] = await Promise.all([
      fetch('/api/superadmin/subscriptions'),
      fetch('/api/superadmin/organizations'),
    ])
    if (subsRes.ok) setSubs(await subsRes.json())
    if (orgsRes.ok) setOrgs(await orgsRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError(null)
    setShowModal(true)
  }

  function openEdit(s: Subscription) {
    setEditing(s)
    setForm({
      organization_id: s.organization_id,
      plan: s.plan,
      status: s.status,
      trial_ends_at: s.trial_ends_at?.slice(0, 10) ?? '',
      current_period_start: s.current_period_start?.slice(0, 10) ?? '',
      current_period_end: s.current_period_end?.slice(0, 10) ?? '',
      price_usd: s.price_usd?.toString() ?? '',
      notes: s.notes ?? '',
    })
    setError(null)
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)

    const payload = {
      organization_id: form.organization_id,
      plan: form.plan,
      status: form.status,
      trial_ends_at: form.trial_ends_at || null,
      current_period_start: form.current_period_start || null,
      current_period_end: form.current_period_end || null,
      price_usd: form.price_usd ? parseFloat(form.price_usd) : null,
      notes: form.notes || null,
    }

    const res = await fetch('/api/superadmin/subscriptions', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Error'); setSaving(false); return }

    setShowModal(false)
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta suscripción?')) return
    setDeleting(id)
    await fetch(`/api/superadmin/subscriptions?id=${id}`, { method: 'DELETE' })
    setSubs(prev => prev.filter(s => s.id !== id))
    setDeleting(null)
  }

  const filtered = filter === 'all' ? subs : subs.filter(s => s.status === filter)

  const counts: Record<string, number> = {
    all: subs.length,
    active: subs.filter(s => s.status === 'active').length,
    trial: subs.filter(s => s.status === 'trial').length,
    suspended: subs.filter(s => s.status === 'suspended').length,
    cancelled: subs.filter(s => s.status === 'cancelled').length,
  }

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-[var(--foreground)]">Suscripciones</h1>
          <p className="text-[12px] text-[var(--subtle)] mt-0.5">Gestión de planes y estados por cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--foreground)] transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-colors">
            <Plus size={14} /> Nueva suscripción
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        {(['all', 'active', 'trial', 'suspended', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors',
              filter === s
                ? 'border-[var(--brand)] text-[var(--brand)]'
                : 'border-transparent text-[var(--subtle)] hover:text-[var(--foreground)]'
            )}
          >
            {s === 'all' ? 'Todas' : STATUS_LABEL[s]}
            <span className="ml-1.5 text-[10px] opacity-60">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-[12px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Cliente</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Plan</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Estado</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Precio</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Período</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--subtle)]">Notas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" /></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[12px] text-[var(--subtle)]">No hay suscripciones en esta categoría.</td></tr>
              ) : filtered.map(s => {
                const org = s.organizations
                return (
                  <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[var(--brand-subtle)] flex items-center justify-center flex-shrink-0">
                          <span className="text-[var(--brand)] text-[9px] font-bold">{(org?.name ?? '?').charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-[var(--foreground)] font-medium">{org?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10.5px] px-2 py-0.5 rounded-full font-medium capitalize', PLAN_STYLE[s.plan])}>
                        {s.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10.5px] px-2 py-0.5 rounded-full border font-medium', STATUS_STYLE[s.status])}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{s.price_usd != null ? `USD ${s.price_usd}` : '—'}</td>
                    <td className="px-4 py-3 text-[var(--subtle)] text-[11.5px]">
                      {s.current_period_start && s.current_period_end
                        ? `${fmt(s.current_period_start)} – ${fmt(s.current_period_end)}`
                        : s.trial_ends_at ? `Trial hasta ${fmt(s.trial_ends_at)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--subtle)] text-[11.5px] max-w-[160px] truncate">{s.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-[6px] text-[var(--subtle)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id} className="p-1.5 rounded-[6px] text-[var(--subtle)] hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--surface)] rounded-[14px] border border-[var(--border)] w-full max-w-[480px] shadow-2xl">
            <div className="flex items-center gap-3 p-5 border-b border-[var(--border)]">
              <CreditCard size={16} className="text-[var(--brand)]" />
              <h2 className="text-[14px] font-semibold text-[var(--foreground)]">{editing ? 'Editar suscripción' : 'Nueva suscripción'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-[8px] bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-[12px]">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
              <SASelect label="Cliente *" value={form.organization_id} onChange={e => f('organization_id', e.target.value)} required>
                <option value="">Seleccionar cliente...</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </SASelect>
              <div className="grid grid-cols-2 gap-3">
                <SASelect label="Plan" value={form.plan} onChange={e => f('plan', e.target.value)}>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </SASelect>
                <SASelect label="Estado" value={form.status} onChange={e => f('status', e.target.value)}>
                  <option value="active">Activo</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspendido</option>
                  <option value="cancelled">Cancelado</option>
                </SASelect>
              </div>
              <SAInput label="Precio (USD/mes)" type="number" step="0.01" placeholder="79.00" value={form.price_usd} onChange={e => f('price_usd', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <SAInput label="Inicio período" type="date" value={form.current_period_start} onChange={e => f('current_period_start', e.target.value)} />
                <SAInput label="Fin período" type="date" value={form.current_period_end} onChange={e => f('current_period_end', e.target.value)} />
              </div>
              <SAInput label="Fin de trial" type="date" value={form.trial_ends_at} onChange={e => f('trial_ends_at', e.target.value)} />
              <SAInput label="Notas" placeholder="Observaciones internas..." value={form.notes} onChange={e => f('notes', e.target.value)} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-[8px] border border-[var(--border)] text-[12.5px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-[8px] bg-[var(--brand)] text-white text-[12.5px] font-semibold hover:opacity-90 transition-colors disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
