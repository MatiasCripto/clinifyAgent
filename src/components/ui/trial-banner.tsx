'use client'

import { usePlan } from '@/lib/plans/use-plan'
import { Clock, AlertTriangle, ArrowUpCircle } from 'lucide-react'

export function TrialBanner() {
  const { isTrialing, isTrialExpired, trialDaysLeft, planLabel } = usePlan()

  if (isTrialing) {
    return (
      <div className="mx-5 mt-3 flex items-center justify-between gap-4 px-4 py-2.5 rounded-[12px] bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
            <Clock size={15} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-amber-800 dark:text-amber-300">
              {trialDaysLeft > 0
                ? `Te quedan ${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} de prueba del plan ${planLabel}`
                : 'Hoy vence tu período de prueba'}
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Después elegís el plan que mejor se adapte a tu clínica. Sin compromiso.
            </p>
          </div>
        </div>
        <a
          href="/pricing"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-amber-600 text-white text-[12px] font-semibold hover:bg-amber-700 transition-colors flex-shrink-0"
        >
          <ArrowUpCircle size={13} />
          Ver planes
        </a>
      </div>
    )
  }

  if (isTrialExpired) {
    return (
      <div className="mx-5 mt-3 flex items-center justify-between gap-4 px-4 py-2.5 rounded-[12px] bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-red-800 dark:text-red-300">
              Tu período de prueba del plan {planLabel} terminó
            </p>
            <p className="text-[11px] text-red-700 dark:text-red-400">
              Elegí un plan para seguir usando ClinifyAgent. Tus datos están a salvo.
            </p>
          </div>
        </div>
        <a
          href="https://wa.me/5491168062699"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 transition-colors flex-shrink-0"
        >
          <ArrowUpCircle size={13} />
          Elegir plan
        </a>
      </div>
    )
  }

  return null
}
