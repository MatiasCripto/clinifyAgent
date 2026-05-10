'use client'

import { Avatar } from '@/components/ui/avatar'
import { ProgressBar } from '@/components/ui/progress-bar'
import { getChurnConfig } from '@/lib/utils/formatters'
import type { ChurnEntry } from '@/lib/analytics/engine'

export function ChurnTable({ data }: { data: ChurnEntry[] }) {
  if (!data.length) {
    return <p className="text-center py-8 text-[13px] text-[var(--subtle)]">Sin pacientes en riesgo 🎉</p>
  }

  return (
    <div className="space-y-2">
      {data.map(entry => {
        const name   = `${entry.patient.first_name} ${entry.patient.last_name}`
        const churn  = getChurnConfig(entry.churnRisk as 'low'|'medium'|'high'|'churned')
        const pct    = Math.round(entry.churnProbability * 100)

        return (
          <div key={entry.patient.id} className="flex items-center gap-3 p-3 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
            <Avatar name={name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[var(--foreground)] truncate">{name}</p>
              <p className="text-[10px] text-[var(--subtle)]">
                {entry.recencyDays !== null ? `Hace ${entry.recencyDays}d sin visita` : 'Sin historial'}
                {entry.label ? ` · ${entry.label}` : ''}
              </p>
            </div>
            <div className="w-[120px] flex-shrink-0">
              <div className="flex justify-between text-[10px] mb-1">
                <span style={{ color: churn.color }} className="font-semibold">{churn.label}</span>
                <span className="text-[var(--subtle)]">{pct}%</span>
              </div>
              <ProgressBar value={entry.churnProbability} color={churn.color} height={5} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
