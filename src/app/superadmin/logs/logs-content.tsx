'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { RefreshCw, Search, CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp } from 'lucide-react'

type LogStatus = 'success' | 'failed' | 'skipped'

interface LogEntry {
  id: string
  clinic_id: string | null
  workflow: string
  entity_type: string | null
  entity_id: string | null
  status: LogStatus
  payload: unknown
  error: string | null
  executed_at: string
  clinics?: {
    id: string
    name: string
    organization_id: string
    organizations?: { id: string; name: string }
  } | null
}

interface OrgOption { id: string; name: string }

const STATUS_STYLE: Record<LogStatus, string> = {
  success: 'bg-green-500/15 text-green-300',
  failed:  'bg-red-500/15 text-red-300',
  skipped: 'bg-gray-500/15 text-gray-400',
}
const STATUS_ICON: Record<LogStatus, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircle2,
  failed:  XCircle,
  skipped: MinusCircle,
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function LogsContent() {
  const [logs, setLogs]       = useState<LogEntry[]>([])
  const [total, setTotal]     = useState(0)
  const [orgs, setOrgs]       = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<LogStatus | 'all'>('all')
  const [orgFilter, setOrgFilter]       = useState('')
  const [search, setSearch]             = useState('')
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const LIMIT = 50

  const searchRef = useRef(search)
  searchRef.current = search

  const load = useCallback(async (p = 0) => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(p * LIMIT),
    })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (orgFilter) params.set('orgId', orgFilter)
    if (search) params.set('workflow', search)

    const res = await fetch(`/api/superadmin/logs?${params}`)
    if (res.ok) {
      const json = await res.json()
      setLogs(json.data ?? [])
      setTotal(json.count ?? 0)
    }
    setLoading(false)
  }, [statusFilter, orgFilter, search])

  useEffect(() => {
    fetch('/api/superadmin/organizations').then(r => r.json()).then(setOrgs)
  }, [])

  useEffect(() => {
    setPage(0)
    load(0)
  }, [load])

  const counts = {
    all: total,
    success: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed').length,
    skipped: logs.filter(l => l.status === 'skipped').length,
  }

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-white/90">Logs</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Registro de automatizaciones y workflows del sistema</p>
        </div>
        <button onClick={() => load(page)} disabled={loading} className="p-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por workflow..."
            className="w-full pl-8 pr-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>
        <select
          value={orgFilter}
          onChange={e => setOrgFilter(e.target.value)}
          className="px-3 py-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/70 focus:outline-none focus:border-violet-500/50 transition-colors"
        >
          <option value="">Todos los clientes</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div className="flex items-center gap-1">
          {(['all', 'success', 'failed', 'skipped'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors',
                statusFilter === s
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'bg-white/[0.04] text-white/40 hover:text-white/70'
              )}
            >
              {s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="text-[12px] text-white/30">
        {total} registro{total !== 1 ? 's' : ''} · mostrando página {page + 1} de {Math.max(1, Math.ceil(total / LIMIT))}
      </div>

      {/* Table */}
      <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Estado</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Workflow</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Cliente / Clínica</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Entidad</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-white/30">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[12px] text-white/30">No hay logs.</td></tr>
              ) : logs.map(log => {
                const Icon = STATUS_ICON[log.status]
                const org  = (log.clinics?.organizations as { id: string; name: string } | undefined)
                const isExpanded = expanded === log.id
                return (
                  <>
                    <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[log.status])}>
                          <Icon size={11} />
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/70 font-mono text-[11.5px]">{log.workflow}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white/60">{org?.name ?? '—'}</p>
                          <p className="text-white/30 text-[11px]">{log.clinics?.name ?? '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/40 text-[11.5px]">
                        {log.entity_type && <span>{log.entity_type}</span>}
                        {log.entity_id && <span className="text-white/20 ml-1 font-mono text-[10px]">#{log.entity_id.slice(0, 8)}</span>}
                        {!log.entity_type && '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white/50">{timeAgo(log.executed_at)}</p>
                        <p className="text-white/25 text-[10.5px]">{fmt(log.executed_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {(log.error || log.payload != null) && (
                          <button onClick={() => setExpanded(isExpanded ? null : log.id)} className="p-1.5 rounded-[6px] text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-colors">
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${log.id}-detail`} className="border-b border-white/[0.03]">
                        <td colSpan={6} className="px-4 py-3 bg-white/[0.01]">
                          {log.error && (
                            <div className="mb-2">
                              <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">Error</p>
                              <pre className="text-[11px] text-red-300/80 bg-red-500/5 rounded-[6px] p-2 overflow-x-auto whitespace-pre-wrap">{log.error}</pre>
                            </div>
                          )}
                          {log.payload != null && (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Payload</p>
                              <pre className="text-[10.5px] text-white/40 bg-white/[0.02] rounded-[6px] p-2 overflow-x-auto">{JSON.stringify(log.payload as object, null, 2)}</pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => { setPage(p => p - 1); load(page - 1) }} disabled={page === 0} className="px-3 py-1.5 rounded-[8px] bg-white/[0.04] text-[12px] text-white/50 disabled:opacity-30 hover:bg-white/[0.08] transition-colors">← Anterior</button>
          <span className="text-[12px] text-white/30">Página {page + 1} / {Math.ceil(total / LIMIT)}</span>
          <button onClick={() => { setPage(p => p + 1); load(page + 1) }} disabled={(page + 1) * LIMIT >= total} className="px-3 py-1.5 rounded-[8px] bg-white/[0.04] text-[12px] text-white/50 disabled:opacity-30 hover:bg-white/[0.08] transition-colors">Siguiente →</button>
        </div>
      )}
    </div>
  )
}
