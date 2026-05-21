import { describe, it, expect } from 'vitest'
import { parseAgentResponse, buildAiPrompt } from '@/lib/bot/ai-chat'
import type { AiContext } from '@/lib/bot/ai-chat'

describe('parseAgentResponse', () => {
  it('parses a valid book action JSON', () => {
    const raw = JSON.stringify({
      message: '¡Listo! Turno reservado.',
      action: {
        type: 'book',
        specialty: 'Odontologia',
        professional: 'Dr. Perez',
        date: '20/05/2026',
        time: '10:30',
        patientName: 'Juan Pérez',
        patientDni: '12345678',
      },
    })

    const result = parseAgentResponse(raw)
    expect(result.message).toBe('¡Listo! Turno reservado.')
    expect(result.action).toEqual({
      type: 'book',
      specialty: 'Odontologia',
      professional: 'Dr. Perez',
      date: '20/05/2026',
      time: '10:30',
      patientName: 'Juan Pérez',
      patientDni: '12345678',
    })
  })

  it('parses a valid cancel action with appointmentIds array', () => {
    const raw = JSON.stringify({
      message: 'Cancelé tus turnos.',
      action: {
        type: 'cancel',
        appointmentIds: ['id-1', 'id-2'],
      },
    })

    const result = parseAgentResponse(raw)
    expect(result.message).toBe('Cancelé tus turnos.')
    expect(result.action?.type).toBe('cancel')
    expect(result.action?.appointmentIds).toEqual(['id-1', 'id-2'])
  })

  it('parses a message with null action', () => {
    const raw = JSON.stringify({ message: 'Hola, ¿en qué puedo ayudarte?', action: null })

    const result = parseAgentResponse(raw)
    expect(result.message).toBe('Hola, ¿en qué puedo ayudarte?')
    expect(result.action).toBeNull()
  })

  it('returns raw text as message when JSON is invalid', () => {
    const result = parseAgentResponse('esto no es json')
    expect(result.message).toBe('esto no es json')
    expect(result.action).toBeNull()
  })

  it('handles JSON wrapped in markdown code block', () => {
    const raw = '```json\n{"message": "¡Listo!", "action": null}\n```'

    const result = parseAgentResponse(raw)
    expect(result.message).toBe('¡Listo!')
    expect(result.action).toBeNull()
  })

  it('handles empty string', () => {
    const result = parseAgentResponse('')
    expect(result.message).toBe('')
    expect(result.action).toBeNull()
  })

  it('handles JSON without action field', () => {
    const raw = JSON.stringify({ message: 'Solo mensaje' })

    const result = parseAgentResponse(raw)
    expect(result.message).toBe('Solo mensaje')
    expect(result.action).toBeNull()
  })

  it('parses single appointmentId for backward compat', () => {
    const raw = JSON.stringify({
      message: 'Cancelado.',
      action: { type: 'cancel', appointmentId: 'single-id' },
    })

    const result = parseAgentResponse(raw)
    expect(result.action?.appointmentId).toBe('single-id')
  })

  it('does not crash on malicious input', () => {
    expect(() => parseAgentResponse('null')).not.toThrow()
    expect(() => parseAgentResponse('undefined')).not.toThrow()
    expect(() => parseAgentResponse('{"message":')).not.toThrow()
  })
})

describe('buildAiPrompt', () => {
  const baseCtx: AiContext = {
    state: 'main_menu',
    specialties: [],
    professionals: [],
    clinicName: 'Clínica Test',
    patientName: 'María Gómez',
    isKnownPatient: true,
  }

  it('includes clinic name', () => {
    const prompt = buildAiPrompt('hola', baseCtx)
    expect(prompt).toContain('Clínica: Clínica Test')
  })

  it('includes patient info when valid', () => {
    const prompt = buildAiPrompt('hola', baseCtx)
    expect(prompt).toContain('María Gómez')
    expect(prompt).toContain('Es paciente registrado')
  })

  it('skips garbage patient names (single word)', () => {
    const prompt = buildAiPrompt('hola', {
      ...baseCtx,
      patientName: 'turno',
      isKnownPatient: false,
    })
    expect(prompt).not.toContain('Paciente:')
  })

  it('skips patient names starting with Clínica', () => {
    const prompt = buildAiPrompt('hola', {
      ...baseCtx,
      patientName: 'Clínica dental',
      isKnownPatient: false,
    })
    expect(prompt).not.toContain('Paciente:')
  })

  it('includes specialties and professionals via professionalsBySpecialty', () => {
    const prompt = buildAiPrompt('hola', {
      ...baseCtx,
      specialties: ['Odontologia', 'Kinesiologia'],
      professionals: ['Dr. Perez (Odontologia)'],
      professionalsBySpecialty: { Odontologia: ['Dr. Perez'] },
    })
    expect(prompt).toContain('Odontologia')
    expect(prompt).toContain('Kinesiologia')
    expect(prompt).toContain('Dr. Perez')
    expect(prompt).toContain('Especialidad → profesionales')
  })

  it('includes the user message', () => {
    const prompt = buildAiPrompt('quiero un turno', baseCtx)
    expect(prompt).toContain('quiero un turno')
  })

  it('includes professionalsBySpecialty when present', () => {
    const prompt = buildAiPrompt('hola', {
      ...baseCtx,
      professionalsBySpecialty: { Odontologia: ['Dr. Perez'] },
    })
    expect(prompt).toContain('Especialidad → profesionales')
    expect(prompt).toContain('Odontologia: Dr. Perez')
  })

  it('shows no-appointments message when none exist', () => {
    const prompt = buildAiPrompt('hola', baseCtx)
    expect(prompt).toContain('No hay turnos')
  })
})
