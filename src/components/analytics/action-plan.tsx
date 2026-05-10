import type { Action } from '@/lib/analytics/engine'
import { cn } from '@/lib/utils/cn'

export function ActionPlan({ actions }: { actions: Action[] }) {
  if (!actions.length) {
    return <p className="text-[13px] text-[var(--subtle)] text-center py-6">Sin acciones críticas pendientes ✅</p>
  }

  return (
    <div className="space-y-3">
      {actions.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-4 rounded-[12px] border"
          style={{ borderColor: a.color + '40', background: a.color + '08' }}
        >
          <span className="text-[20px] flex-shrink-0 mt-0.5">{a.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">{a.title}</p>
              <span
                className={cn(
                  'badge text-[10px] flex-shrink-0',
                  a.priority === 'high'   && 'bg-[var(--danger-bg)] text-red-700',
                  a.priority === 'medium' && 'bg-[var(--warning-bg)] text-amber-700',
                  a.priority === 'low'    && 'bg-[var(--success-bg)] text-green-700',
                )}
              >
                {a.priority === 'high' ? 'Urgente' : a.priority === 'medium' ? 'Importante' : 'Oportunidad'}
              </span>
            </div>
            <p className="text-[12px] text-[var(--muted)] leading-relaxed">{a.detail}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: a.color }}>{a.metric}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
