'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Clock, SkipForward, Bell, MessageCircle, BarChart3, Users } from 'lucide-react'

interface AutomationLog {
  id: string
  workflow: string
  entity_type: string
  entity_id: string | null
  status: 'success' | 'failed' | 'skipped'
  payload: Record<string, unknown> | null
  error: string | null
  executed_at: string
}

interface JobStats {
  job: string
  label: string
  icon: string
  success: number
  failed: number
  skipped: number
  lastRun: string | null
}

const JOB_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  'reminder-24h': { label: 'Recordatorio 24h', icon: Bell },
  'reminder-1h': { label: 'Recordatorio 1h', icon: Clock },
  'post-appointment-nps': { label: 'NPS Post-consulta', icon: MessageCircle },
  'churn-recovery': { label: 'Recuperación Churn', icon: Users },
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    failed:  'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    skipped: 'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400',
  }
  const icons: Record<string, React.ComponentType<{ size?: number }>> = {
    success: CheckCircle2,
    failed: XCircle,
    skipped: SkipForward,
  }
  const Icon = icons[status] ?? Clock
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium ${styles[status] ?? ''}`}>
      <Icon size={11} /> {status === 'success' ? 'OK' : status === 'failed' ? 'Error' : 'Saltado'}
    </span>
  )
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export function AutomationsContent() {
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/jobs/automation-log')
    if (res.ok) setLogs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const jobs = new Set(logs.map(l => l.workflow))
  const stats: JobStats[] = Array.from(jobs).map(job => {
    const jobLogs = logs.filter(l => l.workflow === job)
    return {
      job,
      label: JOB_META[job]?.label ?? job,
      icon: job,
      success: jobLogs.filter(l => l.status === 'success').length,
      failed: jobLogs.filter(l => l.status === 'failed').length,
      skipped: jobLogs.filter(l => l.status === 'skipped').length,
      lastRun: jobLogs[0]?.executed_at ?? null,
    }
  })

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--foreground)]">Automatizaciones</h1>
          <p className="text-[12px] text-[var(--subtle)] mt-0.5">Jobs ejecutados: recordatorios, NPS, recuperación de pacientes</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-[10px] border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--muted)] hover:bg-[var(--surface-2)] transition-colors">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = JOB_META[s.job]?.icon ?? Bell
          return (
            <div key={s.job} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-[10px] bg-[var(--brand-subtle)] flex items-center justify-center">
                  <Icon size={17} className="text-[var(--brand)]" />
                </div>
                <p className="text-[12px] font-semibold text-[var(--foreground)]">{s.label}</p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-green-600 font-semibold">{s.success} OK</span>
                {s.failed > 0 && <span className="text-red-500 font-semibold">{s.failed} err</span>}
                {s.skipped > 0 && <span className="text-[var(--subtle)]">{s.skipped} skip</span>}
              </div>
              {s.lastRun && <p className="text-[10px] text-[var(--subtle)] mt-2">Último: {formatTime(s.lastRun)}</p>}
            </div>
          )
        })}
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--subtle)]">Job</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--subtle)]">Estado</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--subtle)]">Detalle</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-[var(--subtle)]">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center"><div className="flex justify-center"><div className="w-5 h-5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" /></div></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-[12px] text-[var(--subtle)]">Sin ejecuciones todavía. Los jobs se ejecutan al llamar /api/jobs/*</td></tr>
              ) : logs.slice(0, 100).map(log => {
                const meta = JOB_META[log.workflow]
                const detail = log.payload
                  ? Object.entries(log.payload).filter(([, v]) => v && typeof v === 'string').slice(0, 2).map(([k, v]) => `${k}=${v}`).join(', ')
                  : log.error ?? '—'
                return (
                  <tr key={log.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--foreground)] font-medium">{meta?.label ?? log.workflow}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={log.status} /></td>
                    <td className="px-4 py-2.5 text-[var(--subtle)] text-[11px] max-w-[300px] truncate">{detail}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-[11px]">{formatTime(log.executed_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
