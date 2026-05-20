'use client'

import { Lock, ArrowUpCircle } from 'lucide-react'
import { usePlan } from '@/lib/plans/use-plan'

interface Props {
  feature: string
  requiredPlan: string
  description?: string
}

export function UpgradeGate({ feature, requiredPlan, description }: Props) {
  const { plan, upgradeLabel } = usePlan()

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
        <Lock size={24} className="text-amber-600" />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[var(--foreground)]">
          {feature}
        </p>
        <p className="text-[13px] text-[var(--subtle)] mt-1 max-w-xs">
          {description ?? `Esta función está disponible en el plan ${requiredPlan} o superior.`}
        </p>
        <p className="text-[12px] text-[var(--subtle)] mt-2">
          Tu plan actual: <strong className="text-[var(--foreground)]">{plan === 'starter' ? 'Starter' : plan === 'pro' ? 'Pro' : 'Enterprise'}</strong>
          {upgradeLabel && (
            <> · Actualizá al plan <strong>{upgradeLabel}</strong></>
          )}
        </p>
      </div>
      <a
        href="/pricing"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--brand)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity mt-2"
      >
        <ArrowUpCircle size={15} />
        Ver planes
      </a>
    </div>
  )
}

export function UpgradeBanner({ feature, requiredPlan }: { feature: string; requiredPlan: string }) {
  const { plan, upgradeLabel } = usePlan()

  return (
    <div className="flex items-start gap-3 p-4 rounded-[12px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="w-8 h-8 rounded-[8px] bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Lock size={15} className="text-amber-600" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
          {feature} no está disponible en tu plan ({plan === 'starter' ? 'Starter' : plan === 'pro' ? 'Pro' : 'Enterprise'})
        </p>
        <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-0.5">
          Esta función requiere el plan {requiredPlan} o superior.
          {upgradeLabel && (
            <> <a href="/pricing" className="font-semibold underline">Actualizar al plan {upgradeLabel}</a></>
          )}
        </p>
      </div>
    </div>
  )
}
