'use client'

import { useState, useRef, useEffect } from 'react'
import { Building2, ChevronDown, Check, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type { Clinic } from '@/lib/types'

interface Props {
  clinics: Clinic[]
  currentClinic: Clinic | null
  onSelect: (clinicId: string) => void
  collapsed?: boolean
}

export function ClinicSelector({ clinics, currentClinic, onSelect, collapsed }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (collapsed) {
    return (
      <button
        title={currentClinic?.name ?? 'Clínica'}
        className="mx-auto mt-3 w-9 h-9 rounded-[10px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] flex items-center justify-center transition-colors"
      >
        <Building2 size={16} className="text-[var(--muted)]" />
      </button>
    )
  }

  return (
    <div ref={ref} className="mx-3 mt-3 relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors flex items-center gap-2 text-left"
      >
        <Building2 size={15} className="text-[var(--muted)] flex-shrink-0" />
        <span className="flex-1 text-[12.5px] font-medium text-[var(--foreground)] truncate">
          {currentClinic?.name ?? 'Seleccionar clínica'}
        </span>
        <ChevronDown size={13} className={cn('text-[var(--subtle)] transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-lg overflow-hidden"
          >
            {clinics.length === 0 ? (
              <p className="text-[12px] text-[var(--subtle)] px-3 py-2.5">Sin clínicas</p>
            ) : (
              clinics.map(clinic => (
                <button
                  key={clinic.id}
                  onClick={() => { onSelect(clinic.id); setOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors',
                    'text-[12.5px]'
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-[6px] flex items-center justify-center flex-shrink-0"
                    style={{ background: '#6366f120' }}
                  >
                    <Building2 size={12} className="text-[var(--brand)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">{clinic.name}</p>
                    {clinic.whatsapp_number
                      ? <p className="text-[10px] text-green-600 truncate">📱 {clinic.whatsapp_number}</p>
                      : clinic.address
                        ? <p className="text-[10px] text-[var(--subtle)] truncate">{clinic.address}</p>
                        : null
                    }
                  </div>
                  {currentClinic?.id === clinic.id && (
                    <Check size={13} className="text-[var(--brand)] flex-shrink-0" />
                  )}
                </button>
              ))
            )}
            <div className="border-t border-[var(--border)]">
              <button className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-[var(--subtle)] hover:text-[var(--brand)] hover:bg-[var(--surface-2)] transition-colors">
                <Plus size={13} /> Agregar sede
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
