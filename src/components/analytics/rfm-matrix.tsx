'use client'

import { ProgressBar } from '@/components/ui/progress-bar'
import type { buildRfmMatrix } from '@/lib/analytics/engine'

type RfmRow = ReturnType<typeof buildRfmMatrix>[number]

export function RfmMatrix({ data }: { data: RfmRow[] }) {
  return (
    <div className="space-y-2">
      {data.map(row => (
        <div key={row.segment} className="flex items-center gap-3 p-3 rounded-[10px]" style={{ background: row.bg }}>
          {/* Label */}
          <div className="w-[88px] flex-shrink-0">
            <p className="text-[12px] font-bold" style={{ color: row.color }}>{row.label}</p>
            <p className="text-[10px] text-[var(--subtle)] leading-tight">{row.description}</p>
          </div>

          {/* Bar */}
          <div className="flex-1">
            <ProgressBar value={row.pct} color={row.color} height={8} />
          </div>

          {/* Count */}
          <div className="w-[36px] text-right flex-shrink-0">
            <span className="text-[13px] font-bold" style={{ color: row.color }}>{row.count}</span>
          </div>

          {/* Pct */}
          <div className="w-[40px] text-right flex-shrink-0">
            <span className="text-[11px] text-[var(--muted)]">{Math.round(row.pct * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}
