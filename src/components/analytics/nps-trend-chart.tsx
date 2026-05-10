'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { buildNpsTrend } from '@/lib/analytics/engine'

type NpsTrendData = ReturnType<typeof buildNpsTrend>

export function NpsTrendChart({ data }: { data: NpsTrendData }) {
  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--subtle)' }} axisLine={false} tickLine={false} />
          <YAxis domain={[-100, 100]} tick={{ fontSize: 11, fill: 'var(--subtle)' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${v}`, 'NPS']}
          />
          <ReferenceLine y={0}  stroke="#6b7280" strokeDasharray="3 3" />
          <ReferenceLine y={50} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Excelente', position: 'right', fontSize: 10, fill: '#10b981' }} />
          <Line type="monotone" dataKey="nps" name="NPS" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
