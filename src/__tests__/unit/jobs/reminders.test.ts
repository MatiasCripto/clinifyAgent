import { describe, it, expect } from 'vitest'

// ── Unit tests for reminder window calculations ──────────────
// Tests the time-window logic without needing Supabase/Evolution

function isInReminderWindow(apptISO: string, hoursFromNow: number, toleranceMin = 30): boolean {
  const appt = new Date(apptISO)
  const now = new Date()
  const windowStart = new Date(now.getTime() + (hoursFromNow - toleranceMin / 60) * 3600 * 1000)
  const windowEnd = new Date(now.getTime() + (hoursFromNow + toleranceMin / 60) * 3600 * 1000)
  return appt >= windowStart && appt <= windowEnd
}

function formatReminderMessage(patientName: string, date: string, time: string, treatment: string, professional: string): string {
  return `¡Hola ${patientName}! 😊\n\nTe recuerdo que ${date} a las ${time} tenés turno de ${treatment} con ${professional}.\n\nSi necesitás cancelar o reprogramar, avisanos. ¡Te esperamos!`
}

function formatNpsMessage(patientName: string): string {
  return `¡Hola ${patientName}! 😊\n\n¿Cómo fue tu experiencia en la consulta? Del 0 al 10, ¿qué puntaje nos darías?`
}

function formatChurnMessage(patientName: string): string {
  return `¡Hola ${patientName}! 👋\n\nHace un tiempo que no te vemos por la clínica y queríamos saber cómo estás.\n\nSi necesitás sacar un turno, podemos ayudarte por acá mismo. Respondé este mensaje y te agendamos sin vueltas.\n\n¡Te extrañamos! 😊`
}

describe('reminder window logic', () => {
  it('appointment in 24h falls within 24h window', () => {
    const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    expect(isInReminderWindow(in24h, 24)).toBe(true)
  })

  it('appointment in 1h falls within 1h window', () => {
    const in1h = new Date(Date.now() + 3600 * 1000).toISOString()
    expect(isInReminderWindow(in1h, 1)).toBe(true)
  })

  it('appointment in 10 days is outside 24h window', () => {
    const in10d = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString()
    expect(isInReminderWindow(in10d, 24)).toBe(false)
  })

  it('appointment 2h ago is outside 1h window', () => {
    const ago2h = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    expect(isInReminderWindow(ago2h, 1)).toBe(false)
  })

  it('appointment in 90min is within 1h window (tolerance)', () => {
    const in90min = new Date(Date.now() + 90 * 60 * 1000).toISOString()
    expect(isInReminderWindow(in90min, 1, 30)).toBe(true)
  })
})

describe('message formatting', () => {
  it('reminder message includes all fields', () => {
    const msg = formatReminderMessage('Juan', '21/05', '10:30', 'Odontologia', 'Dr. Perez')
    expect(msg).toContain('Juan')
    expect(msg).toContain('21/05')
    expect(msg).toContain('10:30')
    expect(msg).toContain('Odontologia')
    expect(msg).toContain('Dr. Perez')
  })

  it('NPS message is personalized', () => {
    const msg = formatNpsMessage('Maria')
    expect(msg).toContain('Maria')
    expect(msg).toContain('0 al 10')
  })

  it('churn message is friendly', () => {
    const msg = formatChurnMessage('Carlos')
    expect(msg).toContain('Carlos')
    expect(msg).toContain('extrañamos')
  })
})

describe('dedup logic', () => {
  // Simulates the isAlreadyProcessed check using a Set
  function createProcessedSet() {
    const processed = new Set<string>()
    return {
      isProcessed: (entityId: string, jobType: string) => processed.has(`${entityId}:${jobType}`),
      markProcessed: (entityId: string, jobType: string) => processed.add(`${entityId}:${jobType}`),
    }
  }

  it('prevents double processing of same entity', () => {
    const tracker = createProcessedSet()
    expect(tracker.isProcessed('appt-1', 'reminder-24h')).toBe(false)
    tracker.markProcessed('appt-1', 'reminder-24h')
    expect(tracker.isProcessed('appt-1', 'reminder-24h')).toBe(true)
  })

  it('different job types are independent', () => {
    const tracker = createProcessedSet()
    tracker.markProcessed('appt-1', 'reminder-24h')
    expect(tracker.isProcessed('appt-1', 'reminder-1h')).toBe(false)
    tracker.markProcessed('appt-1', 'reminder-1h')
    expect(tracker.isProcessed('appt-1', 'reminder-1h')).toBe(true)
  })

  it('different entities are independent', () => {
    const tracker = createProcessedSet()
    tracker.markProcessed('appt-1', 'reminder-24h')
    expect(tracker.isProcessed('appt-2', 'reminder-24h')).toBe(false)
  })
})

describe('retry backoff', () => {
  function calculateBackoffMs(attempt: number, baseMs = 1000): number {
    return baseMs * Math.pow(2, attempt)
  }

  it('attempt 0 = 1s', () => expect(calculateBackoffMs(0)).toBe(1000))
  it('attempt 1 = 2s', () => expect(calculateBackoffMs(1)).toBe(2000))
  it('attempt 2 = 4s', () => expect(calculateBackoffMs(2)).toBe(4000))
  it('attempt 3 = 8s', () => expect(calculateBackoffMs(3)).toBe(8000))
})

describe('churn cooldown', () => {
  function isInCooldown(lastContactIso: string, cooldownDays = 30): boolean {
    const lastDate = new Date(lastContactIso)
    const cooldownEnd = new Date(lastDate.getTime() + cooldownDays * 24 * 3600 * 1000)
    return new Date() < cooldownEnd
  }

  it('contacted today is in cooldown', () => {
    expect(isInCooldown(new Date().toISOString())).toBe(true)
  })

  it('contacted 40 days ago is not in cooldown', () => {
    const ago40d = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()
    expect(isInCooldown(ago40d)).toBe(false)
  })

  it('contacted 5 days ago is in cooldown', () => {
    const ago5d = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    expect(isInCooldown(ago5d)).toBe(true)
  })
})
