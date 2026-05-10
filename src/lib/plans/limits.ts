import type { OrgPlan } from '@/lib/types'

export interface PlanLimits {
  professionals: number      // -1 = unlimited
  clinics: number            // -1 = unlimited
  afip: boolean
  analytics: boolean
}

export const PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  starter: {
    professionals: 1,
    clinics: 1,
    afip: false,
    analytics: true,
  },
  pro: {
    professionals: 5,
    clinics: -1,
    afip: true,
    analytics: true,
  },
  enterprise: {
    professionals: -1,
    clinics: -1,
    afip: true,
    analytics: true,
  },
}

export const PLAN_LABELS: Record<OrgPlan, string> = {
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
}

export const UPGRADE_TO: Record<OrgPlan, OrgPlan | null> = {
  starter:    'pro',
  pro:        'enterprise',
  enterprise: null,
}

export function getLimits(plan: OrgPlan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter
}

export function canAddProfessional(plan: OrgPlan, currentCount: number): boolean {
  const limit = getLimits(plan).professionals
  return limit === -1 || currentCount < limit
}

export function canAddClinic(plan: OrgPlan, currentCount: number): boolean {
  const limit = getLimits(plan).clinics
  return limit === -1 || currentCount < limit
}
