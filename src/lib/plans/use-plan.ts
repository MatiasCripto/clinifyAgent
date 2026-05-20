'use client'

import { useAuth } from '@/lib/hooks/use-auth'
import { getLimits, canAddProfessional as canAddPro, canAddClinic as canAddCl, UPGRADE_TO, PLAN_LABELS } from './limits'
import type { OrgPlan } from '@/lib/types'

export function usePlan() {
  const { authUser } = useAuth()
  const plan = (authUser?.organization?.plan ?? 'starter') as OrgPlan
  const limits = getLimits(plan)
  const upgradeTo = UPGRADE_TO[plan]

  // Trial
  const trialEndsAt = authUser?.organization?.trial_ends_at ?? null
  const isTrialing = trialEndsAt ? new Date(trialEndsAt) > new Date() : false
  const isTrialExpired = trialEndsAt ? new Date(trialEndsAt) <= new Date() : false
  const trialDaysLeft = isTrialing && trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    limits,
    upgradeTo,
    upgradeLabel: upgradeTo ? PLAN_LABELS[upgradeTo] : null,
    isTrialing,
    isTrialExpired,
    trialDaysLeft,
    trialEndsAt,
    canAddProfessional: (count: number) => canAddPro(plan, count),
    canAddClinic: (count: number) => canAddCl(plan, count),
    canAddPatient: (count: number) => {
      const limit = limits.patients
      return limit === null || count < limit
    },
    hasAnalytics: limits.analytics,
    hasMultiSucursal: limits.multi_sucursal,
  }
}
