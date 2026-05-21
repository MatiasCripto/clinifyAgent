import { describe, it, expect } from 'vitest'
import { buildRfmMatrix, buildWeeklyDemand, buildHourlyDemand, buildNpsTrend } from '@/lib/analytics/engine'
import type { Appointment, NpsResponse } from '@/lib/types'

function makeApp(o: Partial<Appointment> = {}): Appointment {
  return {
    id: `a-${Math.random().toString(36).slice(2)}`,
    patient_id: 'p-1', clinic_id: 'c-1', professional_id: 'prof-1',
    starts_at: '2026-05-01T10:00:00Z', ends_at: '2026-05-01T10:30:00Z',
    treatment: 'Consulta', status: 'completed', source: 'dashboard',
    notes: null, cancellation_reason: null, reminder_sent: false,
    nps_sent: false, google_event_id: null,
    created_at: '2026-05-01T00:00:00Z',
    ...o,
  } as unknown as Appointment
}

function makeNps(o: Partial<NpsResponse> = {}): NpsResponse {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    appointment_id: 'a-1', patient_id: 'p-1',
    score: 9, comment: null,
    answered_at: '2026-05-01T12:00:00Z', created_at: '2026-05-01T12:00:00Z',
    ...o,
  } as NpsResponse
}

describe('buildRfmMatrix', () => {
  it('returns 6 segments even with empty inputs', () => {
    const result = buildRfmMatrix([], [])
    expect(result).toHaveLength(6)
    expect(result.every(s => s.count === 0)).toBe(true)
  })

  it('each segment has required fields', () => {
    const result = buildRfmMatrix([], [])
    for (const seg of result) {
      expect(seg).toHaveProperty('segment')
      expect(seg).toHaveProperty('label')
      expect(seg).toHaveProperty('count')
      expect(seg).toHaveProperty('color')
      expect(seg.segment).toBeTruthy()
    }
  })
})

describe('buildWeeklyDemand', () => {
  it('returns 7 days even with empty input', () => {
    const result = buildWeeklyDemand([])
    expect(result).toHaveLength(7)
  })

  it('counts appointments by day', () => {
    const apps = [
      makeApp({ starts_at: '2026-05-04T10:00:00Z' }), // Monday 2026
      makeApp({ starts_at: '2026-05-04T11:00:00Z' }), // Monday
      makeApp({ starts_at: '2026-05-05T10:00:00Z' }), // Tuesday
    ]
    const result = buildWeeklyDemand(apps)
    const monday = result.find(d => d.label === 'Lun')
    const tuesday = result.find(d => d.label === 'Mar')
    expect(monday?.count).toBe(2)
    expect(tuesday?.count).toBe(1)
  })
})

describe('buildHourlyDemand', () => {
  it('returns hours 8-19 even with empty input', () => {
    const result = buildHourlyDemand([])
    expect(result.length).toBeGreaterThanOrEqual(12)
  })

  it('groups by hour', () => {
    // Use local time strings to avoid timezone issues in test environment
    const now = new Date()
    const h1 = 10
    const h2 = 15
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = '04'
    const apps = [
      makeApp({ starts_at: `${yyyy}-${mm}-${dd}T${String(h1).padStart(2,'0')}:00:00` }),
      makeApp({ starts_at: `${yyyy}-${mm}-${dd}T${String(h1).padStart(2,'0')}:30:00` }),
      makeApp({ starts_at: `${yyyy}-${mm}-${dd}T${String(h2).padStart(2,'0')}:00:00` }),
    ]
    const result = buildHourlyDemand(apps)
    const r1 = result.find(h => h.hour === h1)
    const r2 = result.find(h => h.hour === h2)
    expect(r1?.count).toBe(2)
    expect(r2?.count).toBe(1)
  })
})

describe('buildNpsTrend', () => {
  it('returns empty array for no responses', () => {
    const result = buildNpsTrend([])
    expect(result).toEqual([])
  })

  it('calculates NPS 100 for promoters only', () => {
    const result = buildNpsTrend([
      makeNps({ score: 10, created_at: '2026-05-01T12:00:00Z' }),
    ])
    expect(result[0].nps).toBe(100)
  })

  it('calculates NPS -100 for detractors only', () => {
    const result = buildNpsTrend([
      makeNps({ score: 3, created_at: '2026-05-01T12:00:00Z' }),
    ])
    expect(result[0].nps).toBe(-100)
  })

  it('calculates NPS 0 for mixed scores', () => {
    const result = buildNpsTrend([
      makeNps({ id: 'n1', score: 9, created_at: '2026-05-01T12:00:00Z' }),
      makeNps({ id: 'n2', score: 7, created_at: '2026-05-01T12:00:00Z' }),
      makeNps({ id: 'n3', score: 5, created_at: '2026-05-01T12:00:00Z' }),
    ])
    expect(result[0].nps).toBe(0)
  })

  it('groups by month', () => {
    const result = buildNpsTrend([
      makeNps({ id: 'n1', score: 10, created_at: '2026-01-15T12:00:00Z' }),
      makeNps({ id: 'n2', score: 8, created_at: '2026-02-10T12:00:00Z' }),
    ])
    expect(result).toHaveLength(2)
    expect(result[0].month).not.toBe(result[1].month)
  })
})
