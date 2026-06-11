import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── Permissive chainable mock for Supabase service client ──────────
// Supports any combination of select/eq/order/in/limit/gte/lte/maybeSingle/single/ilike/not
function createChain() {
  const chain: Record<string, unknown> = {}
  // Query builder methods — each returns the chain itself
  for (const m of ['select', 'eq', 'order', 'in', 'limit', 'gte', 'lte', 'ilike', 'not']) {
    chain[m] = vi.fn(() => chain)
  }
  // Terminal methods — return resolved promises with empty data
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
  // Modifier methods
  chain.insert = vi.fn(() => chain)
  chain.upsert = vi.fn(() => Promise.resolve({ error: null }))
  chain.update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return chain
}

const mockChain = createChain()
const mockServiceClient = { from: vi.fn(() => mockChain) }

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
}))

vi.mock('@/lib/utils/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

const mockExtractPhone = vi.fn((jid: string) => jid.replace(/@.*$/, ''))
const mockExtractText = vi.fn(() => 'Hola')
vi.mock('@/lib/bot/intent-classifier', () => ({
  extractPhone: (...args: [string]) => mockExtractPhone(...args),
  extractText: (...args: [unknown]) => mockExtractText(...args),
}))

const mockProcessMessage = vi.fn(() => ({
  newContext: { phone: '5491168062699', state: 'idle', specialties: [], professionals: [], history: [], lastMessageAt: new Date().toISOString(), patientName: null, isKnownPatient: false, patientId: null, pendingDni: null, selectedSpecialty: null, selectedProfessional: null, selectedDate: null, selectedTime: null, selectedAppointmentId: null, availableDatesList: undefined, availableSlotsList: undefined, upcomingAppointments: [], clinicName: null },
  responses: ['¡Hola! ¿En qué puedo ayudarte?'],
  shouldEndSession: false,
}))
const mockCreateInitialContext = vi.fn(() => ({
  phone: '5491168062699',
  state: 'idle',
  patientName: null,
  isKnownPatient: false,
  patientId: null,
  pendingDni: null,
  specialties: [],
  professionals: [],
  selectedSpecialty: null,
  selectedProfessional: null,
  selectedDate: null,
  selectedTime: null,
  selectedAppointmentId: null,
  availableDatesList: undefined,
  availableSlotsList: undefined,
  upcomingAppointments: [],
  clinicName: null,
  history: [],
  lastMessageAt: new Date().toISOString(),
}))
vi.mock('@/lib/bot/conversation-engine', () => ({
  processMessage: (...args: [string, unknown, string?]) => mockProcessMessage(...args),
  createInitialContext: (phone: string) => mockCreateInitialContext(phone),
}))

const mockSendMultiple = vi.fn(() => Promise.resolve())
vi.mock('@/lib/bot/evolution-client', () => ({
  sendMultiple: (...args: [string, string[]]) => mockSendMultiple(...args),
}))

const mockGenerateAiResponse = vi.fn(() => Promise.resolve(null))
vi.mock('@/lib/bot/ai-chat', () => ({
  generateAiResponse: (...args: [string, unknown, string?]) => mockGenerateAiResponse(...args),
}))

import { POST } from '@/app/api/webhooks/whatsapp/route'

describe('POST /api/webhooks/whatsapp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chain terminal methods
    mockChain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
    mockChain.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
    delete process.env.WEBHOOK_SECRET
  })

  it('rejects requests without WEBHOOK_SECRET when header is set', async () => {
    process.env.WEBHOOK_SECRET = 'super-secret'

    const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'messages.upsert', data: {} }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('accepts request with valid WEBHOOK_SECRET', async () => {
    process.env.WEBHOOK_SECRET = 'super-secret'

    const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': 'super-secret' },
      body: JSON.stringify({
        event: 'messages.upsert',
        instance: 'bot-instance',
        data: {
          key: { remoteJid: '5491168062699@s.whatsapp.net', fromMe: false },
          pushName: 'Test User',
          message: { conversation: 'Hola' },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('ignores fromMe messages', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'messages.upsert',
        data: {
          key: { remoteJid: '5491168062699@s.whatsapp.net', fromMe: true },
          pushName: 'Bot',
          message: { conversation: 'Hola' },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('rejects invalid JSON payload', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('skips non-messages.upsert events', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'status.update', data: {} }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipped).toBe('status.update')
  })

  it('processes a valid message end-to-end', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'messages.upsert',
        instance: 'bot-instance',
        data: {
          key: { remoteJid: '5491168062699@s.whatsapp.net', fromMe: false },
          pushName: 'Juan',
          message: { conversation: 'Hola' },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('extracts text from extendedTextMessage', async () => {
    mockExtractText.mockReturnValueOnce('Quiero turno')

    const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'messages.upsert',
        data: {
          key: { remoteJid: '5491168062699@c.us', fromMe: false },
          pushName: 'María',
          message: { extendedTextMessage: { text: 'Quiero turno' } },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
