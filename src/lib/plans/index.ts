import type { OrgPlan } from '@/lib/types'
import { PLAN_LIMITS, type PlanLimits } from './limits'

export type { PlanLimits }

export function getPlanLimits(plan: OrgPlan | string | undefined): PlanLimits {
  const p = (plan as OrgPlan) ?? 'starter'
  return PLAN_LIMITS[p] ?? PLAN_LIMITS.starter
}

export function canAddPatient(plan: string | undefined, currentCount: number): boolean {
  const limit = getPlanLimits(plan).patients
  return limit === null || currentCount < limit
}

export function canAddProfessional(plan: string | undefined, currentCount: number): boolean {
  const limit = getPlanLimits(plan).professionals
  return limit === null || currentCount < limit
}

export function canAddClinic(plan: string | undefined, currentCount: number): boolean {
  const limit = getPlanLimits(plan).clinics
  return limit === null || currentCount < limit
}

export function hasAnalytics(plan: string | undefined): boolean {
  return getPlanLimits(plan).analytics
}

export function hasMultiSucursal(plan: string | undefined): boolean {
  return getPlanLimits(plan).multi_sucursal
}
