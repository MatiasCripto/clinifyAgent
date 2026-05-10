'use client'

import { Lock } from 'lucide-react'

interface Props {
  feature: string
  upgradeLabel: string | null
  description?: string
}

export function PlanLimitBanner({ feature, upgradeLabel, description }: Props) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-[12px] bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
      <div className="w-8 h-8 rounded-[8px] bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Lock size={15} className="text-amber-600" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
          {feature} no está disponible en tu plan actual
        </p>
        <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-0.5">
          {description ?? 'Esta función requiere un plan superior.'}
          {upgradeLabel && (
            <> Contactá al administrador para actualizar al plan <strong>{upgradeLabel}</strong>.</>
          )}
        </p>
      </div>
    </div>
  )
}

interface BlockedProps {
  feature: string
  upgradeLabel: string | null
}

export function PlanLimitBlock({ feature, upgradeLabel }: BlockedProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
        <Lock size={24} className="text-amber-600" />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[var(--foreground)]">{feature}</p>
        <p className="text-[13px] text-[var(--subtle)] mt-1 max-w-xs">
          Esta función no está incluida en tu plan actual.
          {upgradeLabel && <> Actualizá al plan <strong>{upgradeLabel}</strong> para acceder.</>}
        </p>
        <p className="text-[12px] text-[var(--subtle)] mt-2">Contactá a tu proveedor para cambiar de plan.</p>
      </div>
    </div>
  )
}
