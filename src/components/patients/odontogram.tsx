'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

export type ToothCondition = 'healthy' | 'caries' | 'filled' | 'crown' | 'implant' | 'extracted' | 'root_canal' | 'bridge'

export interface ToothRecord {
  tooth_number: number
  condition: ToothCondition
  notes?: string | null
}

type ToothMap = Record<number, ToothRecord>

export const CONDITIONS: Record<ToothCondition, { label: string; bg: string; border: string; text: string; dot: string }> = {
  healthy:    { label: 'Sano',       bg: 'bg-slate-50 dark:bg-slate-800',    border: 'border-slate-200 dark:border-slate-600',   text: 'text-slate-500',  dot: 'bg-slate-400' },
  caries:     { label: 'Caries',     bg: 'bg-red-50 dark:bg-red-950',         border: 'border-red-300 dark:border-red-700',       text: 'text-red-600',    dot: 'bg-red-500' },
  filled:     { label: 'Obturado',   bg: 'bg-blue-50 dark:bg-blue-950',       border: 'border-blue-300 dark:border-blue-700',     text: 'text-blue-600',   dot: 'bg-blue-500' },
  crown:      { label: 'Corona',     bg: 'bg-amber-50 dark:bg-amber-950',     border: 'border-amber-300 dark:border-amber-700',   text: 'text-amber-600',  dot: 'bg-amber-500' },
  implant:    { label: 'Implante',   bg: 'bg-green-50 dark:bg-green-950',     border: 'border-green-300 dark:border-green-700',   text: 'text-green-600',  dot: 'bg-green-500' },
  extracted:  { label: 'Ausente',    bg: 'bg-gray-100 dark:bg-gray-800',      border: 'border-gray-300 dark:border-gray-600',     text: 'text-gray-400',   dot: 'bg-gray-400' },
  root_canal: { label: 'Endodoncia', bg: 'bg-purple-50 dark:bg-purple-950',   border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-600', dot: 'bg-purple-500' },
  bridge:     { label: 'Puente',     bg: 'bg-orange-50 dark:bg-orange-950',   border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-600', dot: 'bg-orange-500' },
}

// ISO tooth numbers in display order (left→right on screen)
// Upper: Q1(right→center) then Q2(center→left)
// Lower: Q4(right→center) then Q3(center→left)
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]

const CONDITION_ORDER: ToothCondition[] = [
  'healthy', 'caries', 'filled', 'crown', 'implant', 'extracted', 'root_canal', 'bridge',
]

function ToothBox({
  number,
  record,
  onChange,
}: {
  number: number
  record: ToothRecord
  onChange: (n: number, c: ToothCondition) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cond = record.condition
  const cfg  = CONDITIONS[cond]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title={`${number} · ${cfg.label}`}
        className={cn(
          'w-8 h-10 rounded-[5px] border-2 flex flex-col items-center justify-center gap-0.5',
          'transition-all hover:scale-110 hover:z-10 hover:shadow-md select-none',
          cfg.bg, cfg.border,
          open && 'ring-2 ring-[var(--brand)] scale-110 z-10',
          cond === 'extracted' && 'opacity-60'
        )}
      >
        <span className={cn('text-[9px] font-bold leading-none', cfg.text)}>{number}</span>
        {cond === 'extracted' ? (
          <span className="text-[10px] font-bold text-gray-400">✕</span>
        ) : cond !== 'healthy' ? (
          <div className={cn('w-2.5 h-2.5 rounded-full', cfg.dot)} />
        ) : (
          <div className="w-2.5 h-2.5" />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-30 w-[130px] bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-xl p-1.5 space-y-0.5">
          {CONDITION_ORDER.map(c => {
            const ccfg = CONDITIONS[c]
            return (
              <button
                key={c}
                onClick={() => { onChange(number, c); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-[11.5px] font-medium transition-colors',
                  c === cond
                    ? 'bg-[var(--brand-subtle)] text-[var(--brand)]'
                    : 'hover:bg-[var(--surface-2)] text-[var(--muted)]'
                )}
              >
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', ccfg.dot)} />
                {ccfg.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface OdontogramProps {
  patientId: string
  teeth: ToothMap
  onToothChange: (toothNumber: number, condition: ToothCondition) => void
  saving?: number | null
}

export function Odontogram({ patientId: _patientId, teeth, onToothChange, saving }: OdontogramProps) {
  function getRecord(n: number): ToothRecord {
    return teeth[n] ?? { tooth_number: n, condition: 'healthy' }
  }

  function Row({ numbers, label }: { numbers: number[]; label: string }) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-[var(--subtle)] w-12 text-right leading-tight pr-1">{label}</span>
        <div className="flex gap-0.5">
          {numbers.map(n => (
            <ToothBox key={n} number={n} record={getRecord(n)} onChange={onToothChange} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Jaw diagram */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-fit">
          <div className="space-y-1">
            {/* Upper jaw */}
            <div className="flex items-center gap-3">
              <Row numbers={UPPER_RIGHT} label="Superior D" />
              <div className="w-px h-10 bg-[var(--border)]" />
              <Row numbers={UPPER_LEFT} label="" />
            </div>

            {/* Center line */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[9px] text-[var(--subtle)] whitespace-nowrap px-2">— línea media —</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {/* Lower jaw */}
            <div className="flex items-center gap-3">
              <Row numbers={LOWER_RIGHT} label="Inferior D" />
              <div className="w-px h-10 bg-[var(--border)]" />
              <Row numbers={LOWER_LEFT} label="" />
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border)]">
        {CONDITION_ORDER.map(c => {
          const cfg = CONDITIONS[c]
          const count = Object.values(teeth).filter(t => t.condition === c && c !== 'healthy').length
          return (
            <div key={c} className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
              <span className="text-[10.5px] text-[var(--subtle)]">{cfg.label}</span>
              {count > 0 && (
                <span className="text-[10px] font-semibold text-[var(--muted)]">({count})</span>
              )}
            </div>
          )
        })}
      </div>

      {saving && (
        <p className="text-[11px] text-[var(--subtle)] flex items-center gap-1.5">
          <span className="w-3 h-3 border border-[var(--brand)] border-t-transparent rounded-full animate-spin inline-block" />
          Guardando diente {saving}...
        </p>
      )}
    </div>
  )
}
