import type { OrgPlan } from '@/lib/types'

export interface PlanLimits {
  professionals: number | null   // null = unlimited
  clinics: number | null         // null = unlimited
  patients: number | null        // null = unlimited
  analytics: boolean
  multi_sucursal: boolean
}

export const PLAN_LIMITS: Record<OrgPlan, PlanLimits> = {
  starter: {
    professionals: 1,
    clinics: 1,
    patients: 500,
    analytics: false,
    multi_sucursal: false,
  },
  pro: {
    professionals: 3,
    clinics: 2,
    patients: null,
    analytics: true,
    multi_sucursal: true,
  },
  enterprise: {
    professionals: null,
    clinics: null,
    patients: null,
    analytics: true,
    multi_sucursal: true,
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
  return limit === null || currentCount < limit
}

export function canAddClinic(plan: OrgPlan, currentCount: number): boolean {
  const limit = getLimits(plan).clinics
  return limit === null || currentCount < limit
}
