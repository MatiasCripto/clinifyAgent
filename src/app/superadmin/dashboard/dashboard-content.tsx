'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  Building2, Users, DollarSign, TrendingUp, Activity,
  Calendar, Zap, MessageSquare, AlertTriangle, CheckCircle2,
  RefreshCw, Clock, XCircle, LifeBuoy,
} from 'lucide-react'

interface DashboardData {
  kpis: {
    active: number
    inactive: number
    total: number
    newThisMonth: number
    mrr: number
    totalUsers: number
    botsActive: number
    openTickets: number
  }
  activity: {
    appointmentsToday: number
    automationsToday: number
  }
  planBreakdown: Array<{ plan: string; count: number; mrr: number }>
  alerts: Array<{ type: string; message: string; severity: 'critical' | 'warning' | 'info' }>
  recentOrgs: Array<{ id: string; name: string; plan: string; is_active: boolean; created_at: string }>
}

function KpiCard({
  label, value, sub, icon: Icon, color, prefix = '', suffix = '',
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center', color)}>
          <Icon size={17} />
        </div>
      </div>
      <p className="text-[22px] font-bold text-white leading-none">
        {prefix}{typeof value === 'number' ? value.toLocaleString('es-AR') : value}{suffix}
      </p>
      <p className="text-[11.5px] text-white/40 mt-1">{label}</p>
      {sub && <p className="text-[10.5px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  )
}

const PLAN_COLOR: Record<string, string> = {
  starter: 'bg-slate-500/20 text-slate-300',
  pro: 'bg-indigo-500/20 text-indigo-300',
  enterprise: 'bg-amber-500/20 text-amber-300',
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/20 text-red-300',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
}

const SEVERITY_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: CheckCircle2,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function DashboardContent() {
  const [data, setData]     = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/dashboard')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-bold text-white/90">Dashboard</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Estado general del SaaS · actualizado en tiempo real</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-white/[0.05] border border-white/[0.08] text-[12px] text-white/50 hover:text-white/80 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* KPI Row 1 */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Clientes activos"
              value={data.kpis.active}
              sub={`${data.kpis.total} total registrados`}
              icon={Building2}
              color="bg-green-500/15 text-green-400"
            />
            <KpiCard
              label="MRR estimado"
              value={data.kpis.mrr}
              sub="basado en planes activos"
              icon={DollarSign}
              color="bg-violet-500/15 text-violet-400"
              prefix="USD "
            />
            <KpiCard
              label="Nuevos este mes"
              value={data.kpis.newThisMonth}
              icon={TrendingUp}
              color="bg-blue-500/15 text-blue-400"
            />
            <KpiCard
              label="Suspendidos"
              value={data.kpis.inactive}
              icon={XCircle}
              color="bg-red-500/15 text-red-400"
            />
          </div>

          {/* KPI Row 2 */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Total usuarios"
              value={data.kpis.totalUsers}
              icon={Users}
              color="bg-cyan-500/15 text-cyan-400"
            />
            <KpiCard
              label="Bots activos"
              value={data.kpis.botsActive}
              sub="clínicas con WhatsApp"
              icon={MessageSquare}
              color="bg-emerald-500/15 text-emerald-400"
            />
            <KpiCard
              label="Turnos hoy"
              value={data.activity.appointmentsToday}
              icon={Calendar}
              color="bg-orange-500/15 text-orange-400"
            />
            <KpiCard
              label="Tickets abiertos"
              value={data.kpis.openTickets}
              icon={LifeBuoy}
              color="bg-pink-500/15 text-pink-400"
            />
          </div>

          {/* Alerts + Activity */}
          <div className="grid grid-cols-3 gap-4">
            {/* Alerts */}
            <div className="col-span-2 rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-amber-400" />
                <h2 className="text-[13px] font-semibold text-white/80">Alertas del sistema</h2>
              </div>
              {data.alerts.length === 0 ? (
                <div className="flex items-center gap-2 py-4">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <p className="text-[13px] text-white/40">Todo en orden. Sin alertas activas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.alerts.map((alert, i) => {
                    const Icon = SEVERITY_ICON[alert.severity]
                    return (
                      <div key={i} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-[8px] border text-[12.5px]', SEVERITY_STYLE[alert.severity])}>
                        <Icon size={14} className="flex-shrink-0" />
                        {alert.message}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Activity */}
            <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className="text-violet-400" />
                <h2 className="text-[13px] font-semibold text-white/80">Actividad hoy</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] text-white/50">
                    <Calendar size={13} className="text-orange-400" />
                    Turnos agendados
                  </div>
                  <span className="text-[13px] font-semibold text-white/80">{data.activity.appointmentsToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] text-white/50">
                    <Zap size={13} className="text-yellow-400" />
                    Automatizaciones
                  </div>
                  <span className="text-[13px] font-semibold text-white/80">{data.activity.automationsToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] text-white/50">
                    <MessageSquare size={13} className="text-green-400" />
                    Bots conectados
                  </div>
                  <span className="text-[13px] font-semibold text-white/80">{data.kpis.botsActive}</span>
                </div>
              </div>

              {/* Plan breakdown */}
              <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
                <p className="text-[11px] text-white/30 uppercase tracking-wider mb-3">Por plan</p>
                {data.planBreakdown.map(p => (
                  <div key={p.plan} className="flex items-center justify-between">
                    <span className={cn('text-[10.5px] px-2 py-0.5 rounded-full font-medium capitalize', PLAN_COLOR[p.plan])}>
                      {p.plan}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-white/50">{p.count} clientes</span>
                      <span className="text-[11px] text-white/30">USD {p.mrr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent clients */}
          <div className="rounded-[12px] bg-[#15151f] border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-white/30" />
                <h2 className="text-[13px] font-semibold text-white/80">Clientes recientes</h2>
              </div>
              <a href="/superadmin/clients" className="text-[12px] text-violet-400 hover:text-violet-300 transition-colors">
                Ver todos →
              </a>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/30">Organización</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/30">Plan</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/30">Creado</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/30">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrgs.map(org => (
                  <tr key={org.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/40 to-indigo-500/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-white/80 text-[9px] font-bold">{org.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-white/70 font-medium">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-[10.5px] px-2 py-0.5 rounded-full font-medium capitalize', PLAN_COLOR[org.plan])}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-white/40">{formatDate(org.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 text-[10.5px] font-medium',
                        org.is_active ? 'text-green-400' : 'text-red-400'
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', org.is_active ? 'bg-green-400' : 'bg-red-400')} />
                        {org.is_active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
