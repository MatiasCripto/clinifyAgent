'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { cn } from '@/lib/utils/cn'
import type { buildWeeklyDemand, buildMonthlyTrend, buildHourlyDemand } from '@/lib/analytics/engine'

type WeeklyData  = ReturnType<typeof buildWeeklyDemand>
type MonthlyData = ReturnType<typeof buildMonthlyTrend>
type HourlyData  = ReturnType<typeof buildHourlyDemand>

// ── Weekly bar chart ────────────────────────────────────────
export function WeeklyDemandChart({ data }: { data: WeeklyData }) {
  return (
    <div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--subtle)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: 'var(--surface-2)' }}
            />
            <Bar dataKey="count" name="Turnos" fill="#6366f1" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Legends */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {data.filter(d => d.isSaturated).map(d => (
          <span key={d.label} className="badge bg-[var(--danger-bg)] text-red-700 text-[10px]">
            🔥 {d.label} saturado
          </span>
        ))}
        {data.filter(d => d.isEmpty).map(d => (
          <span key={d.label} className="badge bg-[var(--success-bg)] text-green-700 text-[10px]">
            💡 {d.label} disponible
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Hourly heatmap ──────────────────────────────────────────
export function HourlyDemandChart({ data }: { data: HourlyData }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex gap-1.5 items-end h-[100px]">
      {data.map(d => (
        <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-[4px] transition-all"
            style={{
              height: `${Math.max((d.count / max) * 80, 4)}px`,
              background: d.count >= max * 0.8 ? '#ef4444' : d.count >= max * 0.5 ? '#f59e0b' : '#6366f1',
              opacity: d.count === 0 ? 0.15 : 1,
            }}
          />
          <span className="text-[9px] text-[var(--subtle)]">{d.label.slice(0,2)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Monthly trend line ──────────────────────────────────────
export function MonthlyTrendChart({ data }: { data: MonthlyData }) {
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--subtle)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--subtle)' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="total"     name="Total"      stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="confirmed" name="Confirmados" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cancelled" name="Cancelados"  stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
