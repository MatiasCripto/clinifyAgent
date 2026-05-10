'use client'

import { getNpsColor, getNpsWord } from '@/lib/utils/formatters'

interface NpsGaugeProps {
  score: number
  promoters: number
  neutrals: number
  detractors: number
  total: number
  compact?: boolean
}

export function NpsGauge({ score, promoters, neutrals, detractors, total, compact }: NpsGaugeProps) {
  const color = getNpsColor(score)
  const word  = getNpsWord(score)
  const pos   = ((score + 100) / 200) * 100

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-[32px] font-bold leading-none" style={{ color }}>
          {score}
        </div>
        <div>
          <p className="text-[12px] font-semibold text-[var(--foreground)]">{word}</p>
          <p className="text-[11px] text-[var(--subtle)]">{total} respuestas</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-[48px] font-bold leading-none text-center tracking-tight" style={{ color }}>
        {score}
      </div>
      <p className="text-center text-[13px] text-[var(--subtle)] mt-1 mb-4">{word}</p>

      {/* Track */}
      <div className="relative h-4 rounded-full overflow-hidden mb-2"
        style={{ background: 'linear-gradient(to right, #ef4444 0%, #ef4444 30%, #f59e0b 30%, #f59e0b 55%, #10b981 55%, #10b981 100%)' }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--foreground)] rounded-full shadow-md"
          style={{ left: `${pos}%`, transform: 'translateX(-50%) translateY(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[var(--subtle)] font-medium mb-5">
        <span>-100 · Crítico</span>
        <span>0</span>
        <span>100 · Excelente</span>
      </div>

      {/* Segments */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-[10px] p-3 text-center bg-[var(--danger-bg)]">
          <div className="text-[22px] font-bold text-red-600 leading-none">{detractors}</div>
          <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mt-1">Detractores</div>
          <div className="text-[10px] text-[var(--subtle)] mt-0.5">0–6</div>
          <div className="text-[12px] font-bold text-red-600 mt-1">
            {Math.round(detractors / total * 100)}%
          </div>
        </div>
        <div className="rounded-[10px] p-3 text-center bg-[var(--warning-bg)]">
          <div className="text-[22px] font-bold text-amber-600 leading-none">{neutrals}</div>
          <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mt-1">Neutros</div>
          <div className="text-[10px] text-[var(--subtle)] mt-0.5">7–8</div>
          <div className="text-[12px] font-bold text-amber-600 mt-1">
            {Math.round(neutrals / total * 100)}%
          </div>
        </div>
        <div className="rounded-[10px] p-3 text-center bg-[var(--success-bg)]">
          <div className="text-[22px] font-bold text-emerald-600 leading-none">{promoters}</div>
          <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mt-1">Promotores</div>
          <div className="text-[10px] text-[var(--subtle)] mt-0.5">9–10</div>
          <div className="text-[12px] font-bold text-emerald-600 mt-1">
            {Math.round(promoters / total * 100)}%
          </div>
        </div>
      </div>
    </div>
  )
}
