import { cn } from '@/lib/utils/cn'

interface ProgressBarProps {
  value: number   // 0–1
  color?: string
  height?: number
  className?: string
}

export function ProgressBar({ value, color = '#6366f1', height = 6, className }: ProgressBarProps) {
  return (
    <div
      className={cn('w-full rounded-full bg-[var(--surface-3)] overflow-hidden', className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(value * 100, 100)}%`, background: color }}
      />
    </div>
  )
}
