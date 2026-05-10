'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { Plus, RefreshCw, Pencil, Trash2, Receipt, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

type BillingStatus = 'pending' | 'paid' | 'overdue'

interface BillingRecord {
  id: string
  organization_id: string
  amount: number
  description: string | null
  due_date: string
  paid_at: string | null
  status: BillingStatus
  notes: string | null
  created_at: string
  updated_at: string
  organizations?: { id: string; name: string }
}

interface OrgOption { id: string; name: string }

const STATUS_STYLE: Record<BillingStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  paid:    'bg-green-500/15 text-green-300 border-green-500/20',
  overdue: 'bg-red-500/15 text-red-300 border-red-500/20',
}
const STATUS_LABEL: Record<BillingStatus, string> = {
  pending: 'Pendiente', paid: 'Pagado', overdue: 'Vencido',
}
const STATUS_ICON: Record<BillingStatus, React.ComponentType<{ size?: number; className?: string }>> = {
  pending: Clock, paid: CheckCircle2, overdue: AlertCircle,
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function SAInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-white/60">{label}</label>}
      <input
        {...props}
        className="w-full px-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
      />
    </div>
  )
}

function SASelect({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-white/60">{label}</label>}
      <select {...props} className="w-full px-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 focus:outline-none focus:border-violet-500/50 transition-colors">
        {children}
      </select>
    </div>
  )
}

const EMPTY_FORM = { organization_id: '', amount: '', description: '', due_date: '', notes: '' }

export function BillingContent() {
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [orgs, setOrgs]       = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<BillingStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<BillingRecord | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [bRes, oRes] = await Promise.all([
      fetch('/api/superadmin/billing'),
      fetch('/api/superadmin/organizations'),
    ])
    if (bRes.ok) setRecords(await bRes.json())
    if (oRes.ok) setOrgs(await oRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function markPaid(r: BillingRecord) {
    await fetch('/api/superadmin/billing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, status: 'paid' }),
    })
    setRecords(prev => prev.map(x => x.id === r.id ? { ...x, status: 'paid', paid_at: new Date().toISOString() } : x))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const payload = {
      organization_id: form.organization_id,
      amount: form.amount,
      description: form.description || null,
      due_date: form.due_date,
      notes: form.notes || null,
    }
    const res = await fetch('/api/superadmin/billing', {
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
    if (!confirm('¿Eliminar este registro?')) return
    await fetch(`/api/superadmin/billing?id=${id}`, { method: 'DELETE' })
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter)

  const totals = {
    pending: records.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0),
    paid: records.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0),
    overdue: records.filter(r => r.status === 'overdue').reduce((s, r) => s + r.amount, 0),
  }

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-white/90">Facturación</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Registro y control de pagos por cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); setError(null); setShowModal(true) }} className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-500 transition-colors">
            <Plus size={14} /> Nueva factura
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['pending', 'paid', 'overdue'] as BillingStatus[]).map(status => {
          const Icon = STATUS_ICON[status]
          return (
            <div key={status} className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={status === 'paid' ? 'text-green-400' : status === 'overdue' ? 'text-red-400' : 'text-amber-400'} />
                <span className="text-[12px] text-white/40">{STATUS_LABEL[status]}</span>
              </div>
              <p className="text-[20px] font-bold text-white/80">USD {totals[status].toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10.5px] text-white/25 mt-0.5">{records.filter(r => r.status === status).length} registro{records.filter(r => r.status === status).length !== 1 ? 's' : ''}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {(['all', 'pending', 'paid', 'overdue'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn('px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors', filter === s ? 'border-violet-500 text-violet-300' : 'border-transparent text-white/40 hover:text-white/70')}>
            {s === 'all' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Cliente</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Descripción</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Monto</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Vencimiento</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Pagado</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[12px] text-white/30">No hay registros.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-white/70 font-medium">{r.organizations?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-white/40 max-w-[200px] truncate">{r.description ?? '—'}</td>
                  <td className="px-4 py-3 text-white/80 font-semibold">USD {r.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-white/40">{fmt(r.due_date)}</td>
                  <td className="px-4 py-3 text-white/40">{fmt(r.paid_at)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10.5px] px-2 py-0.5 rounded-full border font-medium', STATUS_STYLE[r.status])}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {r.status !== 'paid' && (
                        <button onClick={() => markPaid(r)} className="px-2.5 py-1 rounded-[6px] text-[10.5px] font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                          Marcar pagado
                        </button>
                      )}
                      <button onClick={() => { setEditing(r); setForm({ organization_id: r.organization_id, amount: r.amount.toString(), description: r.description ?? '', due_date: r.due_date?.slice(0,10) ?? '', notes: r.notes ?? '' }); setError(null); setShowModal(true) }} className="p-1.5 rounded-[6px] text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-[6px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#15151f] rounded-[14px] border border-white/[0.08] w-full max-w-[440px] shadow-2xl">
            <div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
              <Receipt size={16} className="text-violet-400" />
              <h2 className="text-[14px] font-semibold text-white/80">{editing ? 'Editar factura' : 'Nueva factura'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-300 text-[12px]"><AlertCircle size={13} /> {error}</div>}
              <SASelect label="Cliente *" value={form.organization_id} onChange={e => f('organization_id', e.target.value)} required>
                <option value="">Seleccionar cliente...</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </SASelect>
              <SAInput label="Monto (USD) *" type="number" step="0.01" placeholder="79.00" value={form.amount} onChange={e => f('amount', e.target.value)} required />
              <SAInput label="Descripción" placeholder="Plan Pro - Junio 2025" value={form.description} onChange={e => f('description', e.target.value)} />
              <SAInput label="Fecha de vencimiento *" type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} required />
              <SAInput label="Notas" placeholder="Observaciones..." value={form.notes} onChange={e => f('notes', e.target.value)} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-[8px] border border-white/[0.08] text-[12.5px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-[8px] bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-500 transition-colors disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
