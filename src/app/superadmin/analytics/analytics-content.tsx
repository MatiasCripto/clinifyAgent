'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { RefreshCw, TrendingUp, Zap, Building2, CheckCircle2 } from 'lucide-react'

interface AnalyticsData {
  growth: Array<{ label: string; new: number }>
  planDist: Array<{ plan: string; total: number; active: number }>
  logsPerMonth: Array<{ label: string; success: number; failed: number }>
  topByAppointments: Array<{ id: string; name: string; count: number }>
  successRate: number
  totalLogs: number
}

const PLAN_COLOR: Record<string, string> = {
  starter:    'bg-slate-500',
  pro:        'bg-indigo-500',
  enterprise: 'bg-amber-500',
}

function MiniBar({ value, max, color = 'bg-violet-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-white/40 w-6 text-right">{value}</span>
    </div>
  )
}

function BarChart({ data, valueKey, color = 'bg-violet-500' }: {
  data: Array<Record<string, string | number>>
  valueKey: string
  color?: string
}) {
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1)
  return (
    <div className="flex items-end gap-2 h-[80px]">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0
        const h = max > 0 ? Math.round((val / max) * 80) : 0
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-white/40">{val > 0 ? val : ''}</span>
            <div className="w-full flex items-end" style={{ height: '60px' }}>
              <div
                className={cn('w-full rounded-t-[3px] transition-all duration-500', color)}
                style={{ height: `${Math.max(h, val > 0 ? 4 : 0)}px` }}
              />
            </div>
            <span className="text-[9px] text-white/30 truncate w-full text-center">{String(d.label)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function AnalyticsContent() {
  const [data, setData]     = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/analytics')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-white/90">Analíticas</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Métricas de crecimiento y uso de la plataforma</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-[8px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-yellow-400" />
                <span className="text-[12px] text-white/50">Tasa de éxito (6 meses)</span>
              </div>
              <p className="text-[28px] font-bold text-white/90">{data.successRate}%</p>
              <p className="text-[11px] text-white/30 mt-1">{data.totalLogs.toLocaleString()} automatizaciones</p>
            </div>
            <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-green-400" />
                <span className="text-[12px] text-white/50">Nuevos clientes (6 meses)</span>
              </div>
              <p className="text-[28px] font-bold text-white/90">{data.growth.reduce((s, g) => s + g.new, 0)}</p>
              <p className="text-[11px] text-white/30 mt-1">últimos 6 meses</p>
            </div>
            <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={14} className="text-violet-400" />
                <span className="text-[12px] text-white/50">Distribución de planes</span>
              </div>
              <div className="space-y-2 mt-1">
                {data.planDist.map(p => (
                  <div key={p.plan} className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', PLAN_COLOR[p.plan])} />
                    <span className="text-[11px] text-white/50 capitalize w-20">{p.plan}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                      <div
                        className={cn('h-full rounded-full', PLAN_COLOR[p.plan])}
                        style={{ width: `${data.planDist.reduce((s, x) => s + x.total, 0) > 0 ? Math.round(p.total / data.planDist.reduce((s, x) => s + x.total, 0) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-white/40">{p.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Growth chart */}
            <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={13} className="text-green-400" />
                <h3 className="text-[13px] font-semibold text-white/80">Nuevos clientes por mes</h3>
              </div>
              <BarChart data={data.growth} valueKey="new" color="bg-violet-500" />
            </div>

            {/* Logs chart */}
            <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={13} className="text-yellow-400" />
                <h3 className="text-[13px] font-semibold text-white/80">Automatizaciones por mes</h3>
              </div>
              <div className="flex items-end gap-2 h-[80px]">
                {data.logsPerMonth.map((d, i) => {
                  const maxVal = Math.max(...data.logsPerMonth.map(x => x.success + x.failed), 1)
                  const total = d.success + d.failed
                  const h = maxVal > 0 ? Math.round((total / maxVal) * 60) : 0
                  const hSuccess = total > 0 ? Math.round((d.success / total) * h) : 0
                  const hFailed = h - hSuccess
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-white/40">{total > 0 ? total : ''}</span>
                      <div className="w-full flex flex-col items-end justify-end" style={{ height: '60px' }}>
                        <div className="w-full rounded-t-[3px] bg-red-500/60" style={{ height: `${hFailed}px` }} />
                        <div className="w-full bg-green-500/60" style={{ height: `${hSuccess}px` }} />
                      </div>
                      <span className="text-[9px] text-white/30 truncate w-full text-center">{d.label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500/60" /><span className="text-[10px] text-white/30">Éxito</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500/60" /><span className="text-[10px] text-white/30">Fallo</span></div>
              </div>
            </div>
          </div>

          {/* Top clients by appointments */}
          <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={13} className="text-cyan-400" />
              <h3 className="text-[13px] font-semibold text-white/80">Clientes más activos (turnos, últimos 6 meses)</h3>
            </div>
            {data.topByAppointments.length === 0 ? (
              <p className="text-[12px] text-white/30">Sin datos de turnos aún.</p>
            ) : (
              <div className="space-y-3">
                {data.topByAppointments.map((org, i) => (
                  <div key={org.id} className="flex items-center gap-3">
                    <span className="text-[11px] text-white/20 w-4">{i + 1}</span>
                    <span className="text-[13px] text-white/70 flex-1">{org.name}</span>
                    <MiniBar
                      value={org.count}
                      max={data.topByAppointments[0]?.count ?? 1}
                      color="bg-cyan-500"
                    />
                    <span className="text-[12px] text-white/50 w-20 text-right">{org.count} turnos</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
