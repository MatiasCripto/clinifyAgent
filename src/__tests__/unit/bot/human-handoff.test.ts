import { describe, it, expect } from 'vitest'
import { processMessage, createInitialContext } from '@/lib/bot/conversation-engine'
import type { BotContext } from '@/lib/types/whatsapp.types'

function ctx(overrides: Partial<BotContext> = {}): BotContext {
  return {
    phone: '5491168062699',
    state: 'idle',
    patientName: 'Juan Pérez',
    isKnownPatient: true,
    patientId: 'p-1',
    pendingDni: null,
    specialties: ['Odontologia', 'Kinesiologia'],
    professionals: ['Dr. Perez (Odontologia)', 'Lic. Gomez (Kinesiologia)'],
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
    ...overrides,
  }
}

describe('human handoff', () => {
  it('main_menu with "quiero hablar con una persona" transitions to human_handoff', () => {
    const { newContext } = processMessage(
      'quiero hablar con una persona',
      ctx({ state: 'main_menu' })
    )
    expect(newContext.state).toBe('human_handoff')
  })

  it('idle state with explicit human intent transitions to human_handoff', () => {
    const { newContext } = processMessage(
      'necesito hablar con alguien',
      ctx({ state: 'idle', patientName: null, isKnownPatient: false })
    )
    expect(newContext.state).toBe('human_handoff')
  })

  it('closed state with "quiero hablar con un humano" transitions to human_handoff', () => {
    const { newContext } = processMessage(
      'quiero hablar con un humano',
      ctx({ state: 'closed' })
    )
    expect(newContext.state).toBe('human_handoff')
  })

  it('main_menu with "hablar con un agente" transitions to human_handoff', () => {
    const { newContext } = processMessage(
      'hablar con un agente',
      ctx({ state: 'main_menu' })
    )
    expect(newContext.state).toBe('human_handoff')
  })

  it('greeting state with "hablar con alguien" transitions to human_handoff via global override', () => {
    const { newContext } = processMessage(
      'hablar con alguien',
      ctx({ state: 'greeting', isKnownPatient: false, patientName: null })
    )
    expect(newContext.state).toBe('human_handoff')
  })

  it('booking flow does NOT auto-escalate to human (AI handles it)', () => {
    // The state machine intentionally skips human handoff during booking states
    const { newContext } = processMessage(
      'no me gusta, quiero hablar con un humano',
      ctx({ state: 'booking_specialty' })
    )
    // Booking states are excluded from the global ask_human override
    expect(newContext.state).not.toBe('human_handoff')
    expect(newContext.state).toBe('booking_specialty')
  })
})
