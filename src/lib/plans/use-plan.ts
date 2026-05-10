'use client'

import { useAuth } from '@/lib/hooks/use-auth'
import { getLimits, canAddProfessional, canAddClinic, UPGRADE_TO, PLAN_LABELS } from './limits'
import type { OrgPlan } from '@/lib/types'

export function usePlan() {
  const { authUser } = useAuth()
  const plan = (authUser?.organization?.plan ?? 'starter') as OrgPlan
  const limits = getLimits(plan)
  const upgradeTo = UPGRADE_TO[plan]

  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    limits,
    upgradeTo,
    upgradeLabel: upgradeTo ? PLAN_LABELS[upgradeTo] : null,
    canAddProfessional: (count: number) => canAddProfessional(plan, count),
    canAddClinic: (count: number) => canAddClinic(plan, count),
    hasAfip: limits.afip,
    hasAnalytics: limits.analytics,
  }
}
