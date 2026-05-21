import { describe, it, expect } from 'vitest'
import { PLAN_LIMITS, PLAN_LABELS, UPGRADE_TO, getLimits, canAddProfessional, canAddClinic } from '@/lib/plans/limits'

describe('PLAN_LIMITS', () => {
  it('starter has correct limits', () => {
    expect(PLAN_LIMITS.starter).toEqual({
      professionals: 1,
      clinics: 1,
      patients: 500,
      analytics: false,
      multi_sucursal: false,
    })
  })

  it('pro has correct limits', () => {
    expect(PLAN_LIMITS.pro).toEqual({
      professionals: 3,
      clinics: 2,
      patients: null,
      analytics: true,
      multi_sucursal: true,
    })
  })

  it('enterprise has unlimited limits', () => {
    const e = PLAN_LIMITS.enterprise
    expect(e.professionals).toBeNull()
    expect(e.clinics).toBeNull()
    expect(e.patients).toBeNull()
    expect(e.analytics).toBe(true)
    expect(e.multi_sucursal).toBe(true)
  })

  it('all three plans are defined', () => {
    expect(Object.keys(PLAN_LIMITS)).toHaveLength(3)
    expect(PLAN_LIMITS).toHaveProperty('starter')
    expect(PLAN_LIMITS).toHaveProperty('pro')
    expect(PLAN_LIMITS).toHaveProperty('enterprise')
  })
})

describe('getLimits', () => {
  it('returns correct limits for each plan', () => {
    expect(getLimits('starter').professionals).toBe(1)
    expect(getLimits('pro').professionals).toBe(3)
    expect(getLimits('enterprise').professionals).toBeNull()
  })

  it('falls back to starter for unknown plans', () => {
    const limits = getLimits('unknown' as 'starter')
    expect(limits).toEqual(PLAN_LIMITS.starter)
  })
})

describe('canAddProfessional', () => {
  it('returns true when under limit', () => {
    expect(canAddProfessional('pro', 2)).toBe(true)
  })

  it('returns false when at limit', () => {
    expect(canAddProfessional('starter', 1)).toBe(false)
  })

  it('returns false when over limit', () => {
    expect(canAddProfessional('starter', 3)).toBe(false)
  })

  it('returns true for unlimited plans', () => {
    expect(canAddProfessional('enterprise', 1000)).toBe(true)
  })

  it('returns true for pro at limit boundary', () => {
    expect(canAddProfessional('pro', 2)).toBe(true)
    expect(canAddProfessional('pro', 3)).toBe(false)
  })
})

describe('canAddClinic', () => {
  it('returns true when under limit', () => {
    expect(canAddClinic('pro', 1)).toBe(true)
  })

  it('returns false when at limit', () => {
    expect(canAddClinic('starter', 1)).toBe(false)
  })

  it('returns true for unlimited plans', () => {
    expect(canAddClinic('enterprise', 100)).toBe(true)
  })
})

describe('PLAN_LABELS', () => {
  it('has labels for all plans', () => {
    expect(PLAN_LABELS.starter).toBe('Starter')
    expect(PLAN_LABELS.pro).toBe('Pro')
    expect(PLAN_LABELS.enterprise).toBe('Enterprise')
  })
})

describe('UPGRADE_TO', () => {
  it('starter upgrades to pro', () => {
    expect(UPGRADE_TO.starter).toBe('pro')
  })

  it('pro upgrades to enterprise', () => {
    expect(UPGRADE_TO.pro).toBe('enterprise')
  })

  it('enterprise has no upgrade', () => {
    expect(UPGRADE_TO.enterprise).toBeNull()
  })
})
