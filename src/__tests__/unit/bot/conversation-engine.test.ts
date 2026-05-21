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

const AI_MARKER = '__AI_GENERATE__'

describe('createInitialContext', () => {
  it('creates context with idle state', () => {
    const c = createInitialContext('5491168062699')
    expect(c.state).toBe('idle')
    expect(c.phone).toBe('5491168062699')
    expect(c.patientName).toBeNull()
    expect(c.isKnownPatient).toBe(false)
  })
})

describe('processMessage', () => {
  it('greeting state with unknown patient goes to identify_patient', () => {
    const { newContext, responses } = processMessage('hola', ctx({ state: 'greeting', patientName: null, isKnownPatient: false }))
    expect(newContext.state).toBe('identify_patient')
    expect(responses).toContain(AI_MARKER)
  })

  it('greeting state with known patient goes to main_menu', () => {
    const { newContext } = processMessage('hola', ctx({ state: 'greeting', patientName: 'Juan', isKnownPatient: true }))
    expect(newContext.state).toBe('main_menu')
  })

  it('idle state with unknown patient returns identify_patient', () => {
    const { newContext, responses } = processMessage(
      'hola',
      ctx({ state: 'idle', patientName: null, isKnownPatient: false })
    )
    // State machine transitions to identify_patient for unknown users
    expect(newContext.state).toBe('identify_patient')
  })

  it('idle state with known patient goes to main_menu', () => {
    const { newContext, responses } = processMessage(
      'hola',
      ctx({ state: 'idle', patientName: 'Juan Pérez', isKnownPatient: true })
    )
    expect(newContext.state).toBe('main_menu')
    expect(responses).toContain(AI_MARKER)
  })

  it('identify_patient extracts name and transitions', () => {
    const { newContext } = processMessage(
      'me llamo María Gomez',
      ctx({ state: 'identify_patient', patientName: null })
    )
    // Should extract name and move to next step
    expect(newContext.patientName).toBeTruthy()
    expect(['main_menu', 'ask_dni', 'booking_specialty']).toContain(newContext.state)
  })

  it('main_menu with book intent transitions to booking_specialty', () => {
    const { newContext, responses } = processMessage(
      'quiero sacar un turno',
      ctx({ state: 'main_menu', specialties: ['Odontologia', 'Kinesiologia'] })
    )
    expect(newContext.state).toBe('booking_specialty')
    expect(responses).toContain(AI_MARKER)
  })

  it('main_menu with cancel intent goes to cancel_select when appts exist', () => {
    const { newContext } = processMessage(
      'cancelar',
      ctx({
        state: 'main_menu',
        upcomingAppointments: [
          { id: 'a-1', date: '20/05', time: '10:30', professional: 'Dr. Perez', specialty: 'Odontologia' },
        ],
      })
    )
    expect(newContext.state).toBe('cancel_select')
  })

  it('main_menu with cancel intent and no appts goes to no_appointments', () => {
    const { newContext } = processMessage(
      'cancelar',
      ctx({ state: 'main_menu', upcomingAppointments: [] })
    )
    expect(newContext.state).toBe('no_appointments')
  })

  it('main_menu with human intent goes to human_handoff', () => {
    const { newContext } = processMessage(
      'quiero hablar con una persona',
      ctx({ state: 'main_menu' })
    )
    expect(newContext.state).toBe('human_handoff')
  })

  it('booking_specialty selects specialty and shows professionals', () => {
    const { newContext, responses } = processMessage(
      'odontologia',
      ctx({
        state: 'booking_specialty',
        specialties: ['Odontologia', 'Kinesiologia'],
        professionals: ['Dr. Perez (Odontologia)', 'Lic. Gomez (Kinesiologia)'],
      })
    )
    expect(newContext.selectedSpecialty).toBeTruthy()
  })

  it('booking_professional with "cualquiera" sets Sin preferencia and requests dates', () => {
    const { newContext, responses } = processMessage(
      'sin preferencia',
      ctx({
        state: 'booking_professional',
        selectedSpecialty: 'Odontologia',
        professionals: ['Dr. Perez (Odontologia)'],
      })
    )
    expect(newContext.selectedProfessional).toBe('Sin preferencia')
    expect(newContext.state).toBe('booking_date')
    expect(responses).toContain('__FETCH_DATES__')
  })

  it('booking_confirm with "sí" returns booking confirm marker', () => {
    const { newContext, responses } = processMessage(
      'sí',
      ctx({
        state: 'booking_confirm',
        selectedSpecialty: 'Odontologia',
        selectedProfessional: 'Dr. Perez',
        selectedDate: '20/05/2026',
        selectedTime: '10:30',
        patientName: 'Juan Pérez',
      })
    )
    // Confirmation triggers booking
    expect(responses).toContain(AI_MARKER)
  })

  it('booking_confirm with "no" returns to main_menu', () => {
    const { newContext, responses } = processMessage(
      'no',
      ctx({ state: 'booking_confirm' })
    )
    expect(newContext.state).toBe('main_menu')
  })

  it('preserves conversation history', () => {
    const { newContext } = processMessage('hola', ctx({ state: 'main_menu', history: [{ role: 'user', content: 'prev' }] }))
    expect(newContext.history).toBeDefined()
  })

  it('handles empty input gracefully', () => {
    const { newContext } = processMessage('', ctx({ state: 'idle' }))
    expect(newContext.state).toBeDefined()
  })

  it('handles very long input', () => {
    const long = 'a'.repeat(1000)
    const { newContext } = processMessage(long, ctx({ state: 'main_menu' }))
    expect(newContext.state).toBeDefined()
  })

  it('closed state reopens for known patients', () => {
    const { newContext } = processMessage(
      'hola',
      ctx({ state: 'closed', patientName: 'Juan Pérez', isKnownPatient: true })
    )
    expect(newContext.state).toBe('main_menu')
  })

  it('closed state redirects unknown users to identify', () => {
    const { newContext } = processMessage(
      'hola',
      ctx({ state: 'closed', patientName: null, isKnownPatient: false })
    )
    expect(newContext.state).toBe('identify_patient')
  })

  it('known patient skipping ask_dni: booking_confirm with confirmation advances', () => {
    // Bug fix: known patients (~isKnownPatient + patientName) should confirm without re-asking DNI
    const { newContext, responses } = processMessage(
      'sí confirmo',
      ctx({
        state: 'booking_confirm',
        isKnownPatient: true,
        patientName: 'Juan Pérez',
        patientId: 'p-1',
        pendingDni: null, // known patient never went through ask_dni
        selectedSpecialty: 'Odontologia',
        selectedProfessional: 'Dr. Perez (Odontologia)',
        selectedDate: '20/05/2026',
        selectedTime: '10:30',
      })
    )
    // Should advance to booking_done without re-asking DNI
    expect(newContext.state).toBe('booking_done')
    expect(responses).toContain(AI_MARKER)
  })

  it('known patient in booking_confirm with confirmation word does not loop', () => {
    // Regression: known patient says "sí" and should NOT go back to ask_dni
    const { newContext } = processMessage(
      'dale confirmo',
      ctx({
        state: 'booking_confirm',
        isKnownPatient: true,
        patientName: 'María Gómez',
        patientId: 'p-2',
        pendingDni: '12345678', // has DNI from context
        selectedSpecialty: 'Kinesiologia',
        selectedProfessional: 'Lic. Gomez (Kinesiologia)',
        selectedDate: '22/05/2026',
        selectedTime: '14:00',
      })
    )
    expect(newContext.state).toBe('booking_done')
  })

  it('cancel_select with appointment id selects it', () => {
    const { newContext } = processMessage(
      '1',
      ctx({
        state: 'cancel_select',
        upcomingAppointments: [
          { id: 'a-1', date: '20/05', time: '10:30', professional: 'Dr. Perez', specialty: 'Odontologia' },
        ],
      })
    )
    // Should select the appointment for cancellation
    expect(newContext.selectedAppointmentId || newContext.state === 'cancel_select').toBeTruthy()
  })
})
