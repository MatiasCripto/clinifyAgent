'use client'

import { cn } from '@/lib/utils/cn'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string }
  className?: string
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor = 'var(--brand)',
  trend,
  className,
}: StatCardProps) {
  const trendPositive = trend && trend.value > 0
  const trendNeutral  = trend && trend.value === 0

  return (
    <div className={cn('card p-5 flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--subtle)] uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
            style={{ background: iconColor + '18', color: iconColor }}
          >
            <Icon size={16} />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <div
            className="font-bold text-[28px] leading-none tracking-tight text-[var(--foreground)]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </div>
          {sub && (
            <p className="text-[11px] text-[var(--subtle)] mt-1">{sub}</p>
          )}
        </div>

        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full',
              trendNeutral
                ? 'bg-[var(--surface-2)] text-[var(--muted)]'
                : trendPositive
                ? 'bg-[var(--success-bg)] text-green-700'
                : 'bg-[var(--danger-bg)] text-red-700'
            )}
          >
            {trendNeutral
              ? <Minus size={12} />
              : trendPositive
              ? <TrendingUp size={12} />
              : <TrendingDown size={12} />
            }
            <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
