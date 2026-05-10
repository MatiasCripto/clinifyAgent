'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { Plus, RefreshCw, Pencil, Trash2, LifeBuoy, AlertCircle, CheckCircle2, Clock, AlertOctagon } from 'lucide-react'

type TicketStatus   = 'open' | 'in_progress' | 'closed'
type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

interface Ticket {
  id: string
  organization_id: string | null
  title: string
  description: string | null
  priority: TicketPriority
  status: TicketStatus
  created_at: string
  updated_at: string
  organizations?: { id: string; name: string } | null
}

interface OrgOption { id: string; name: string }

const STATUS_STYLE: Record<TicketStatus, string> = {
  open:        'bg-blue-500/15 text-blue-300 border-blue-500/20',
  in_progress: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  closed:      'bg-gray-500/15 text-gray-400 border-gray-500/20',
}
const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Abierto', in_progress: 'En progreso', closed: 'Cerrado',
}

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  low:      'text-gray-400',
  medium:   'text-blue-400',
  high:     'text-amber-400',
  critical: 'text-red-400',
}
const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica',
}
const PRIORITY_ICON: Record<TicketPriority, React.ComponentType<{ size?: number; className?: string }>> = {
  low: Clock, medium: AlertCircle, high: AlertCircle, critical: AlertOctagon,
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function SAInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-white/60">{label}</label>}
      <input {...props} className="w-full px-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
    </div>
  )
}

function SASelect({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-white/60">{label}</label>}
      <select {...props} className="w-full px-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 focus:outline-none focus:border-violet-500/50 transition-colors">{children}</select>
    </div>
  )
}

function SATextarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[12px] font-medium text-white/60">{label}</label>}
      <textarea {...props} className="w-full px-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none" rows={3} />
    </div>
  )
}

const EMPTY_FORM = { organization_id: '', title: '', description: '', priority: 'medium' as TicketPriority }

export function SupportContent() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [orgs, setOrgs]       = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<TicketStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Ticket | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [tRes, oRes] = await Promise.all([
      fetch('/api/superadmin/support'),
      fetch('/api/superadmin/organizations'),
    ])
    if (tRes.ok) setTickets(await tRes.json())
    if (oRes.ok) setOrgs(await oRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(t: Ticket, status: TicketStatus) {
    await fetch('/api/superadmin/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, status }),
    })
    setTickets(prev => prev.map(x => x.id === t.id ? { ...x, status } : x))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const payload = {
      organization_id: form.organization_id || null,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
    }
    const res = await fetch('/api/superadmin/support', {
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

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)
  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  }

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-white/90">Soporte</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Gestión de tickets e incidencias de clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); setError(null); setShowModal(true) }} className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-500 transition-colors">
            <Plus size={14} /> Nuevo ticket
          </button>
        </div>
      </div>

      {/* Stat badges */}
      <div className="flex items-center gap-3">
        {(['open', 'in_progress', 'closed'] as TicketStatus[]).map(s => (
          <div key={s} className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#15151f] border border-white/[0.06]">
            <span className={cn('text-[11px] font-medium', STATUS_STYLE[s].split(' ').slice(1).join(' '))}>{STATUS_LABEL[s]}</span>
            <span className="text-[13px] font-bold text-white/70">{counts[s]}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {(['all', 'open', 'in_progress', 'closed'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn('px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors', filter === s ? 'border-violet-500 text-violet-300' : 'border-transparent text-white/40 hover:text-white/70')}>
            {s === 'all' ? 'Todos' : STATUS_LABEL[s]}
            <span className="ml-1.5 text-[10px] opacity-60">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-8 text-center">
            <LifeBuoy size={24} className="text-white/10 mx-auto mb-2" />
            <p className="text-[13px] text-white/30">Sin tickets en esta categoría.</p>
          </div>
        ) : filtered.map(t => {
          const PIcon = PRIORITY_ICON[t.priority]
          const org = t.organizations as { id: string; name: string } | null
          return (
            <div key={t.id} className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4 hover:border-white/[0.10] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <PIcon size={16} className={cn('mt-0.5 flex-shrink-0', PRIORITY_STYLE[t.priority])} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-white/80">{t.title}</p>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', STATUS_STYLE[t.status])}>{STATUS_LABEL[t.status]}</span>
                      <span className={cn('text-[10px] font-medium', PRIORITY_STYLE[t.priority])}>{PRIORITY_LABEL[t.priority]}</span>
                    </div>
                    {t.description && <p className="text-[12px] text-white/40 mt-1">{t.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      {org && <span className="text-[11px] text-white/30">{org.name}</span>}
                      <span className="text-[11px] text-white/20">{timeAgo(t.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {t.status === 'open' && (
                    <button onClick={() => updateStatus(t, 'in_progress')} className="px-2.5 py-1 rounded-[6px] text-[10.5px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors whitespace-nowrap">
                      En progreso
                    </button>
                  )}
                  {t.status === 'in_progress' && (
                    <button onClick={() => updateStatus(t, 'closed')} className="px-2.5 py-1 rounded-[6px] text-[10.5px] font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                      Cerrar
                    </button>
                  )}
                  {t.status === 'closed' && (
                    <button onClick={() => updateStatus(t, 'open')} className="px-2.5 py-1 rounded-[6px] text-[10.5px] font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                      Reabrir
                    </button>
                  )}
                  <button onClick={() => { setEditing(t); setForm({ organization_id: t.organization_id ?? '', title: t.title, description: t.description ?? '', priority: t.priority }); setError(null); setShowModal(true) }} className="p-1.5 rounded-[6px] text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-colors"><Pencil size={12} /></button>
                  <button onClick={async () => { if (confirm('¿Eliminar ticket?')) { await fetch(`/api/superadmin/support?id=${t.id}`, { method: 'DELETE' }); setTickets(prev => prev.filter(x => x.id !== t.id)) } }} className="p-1.5 rounded-[6px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#15151f] rounded-[14px] border border-white/[0.08] w-full max-w-[440px] shadow-2xl">
            <div className="flex items-center gap-3 p-5 border-b border-white/[0.06]">
              <LifeBuoy size={16} className="text-violet-400" />
              <h2 className="text-[14px] font-semibold text-white/80">{editing ? 'Editar ticket' : 'Nuevo ticket'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-300 text-[12px]"><AlertCircle size={13} /> {error}</div>}
              <SASelect label="Cliente" value={form.organization_id} onChange={e => f('organization_id', e.target.value)}>
                <option value="">Sin cliente específico</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </SASelect>
              <SAInput label="Título *" placeholder="Problema con WhatsApp..." value={form.title} onChange={e => f('title', e.target.value)} required />
              <SATextarea label="Descripción" placeholder="Detalles del problema..." value={form.description} onChange={e => f('description', e.target.value)} />
              <SASelect label="Prioridad" value={form.priority} onChange={e => f('priority', e.target.value)}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </SASelect>
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
