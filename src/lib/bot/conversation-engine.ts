// ============================================================
// Bot conversation state machine
// Pure functions — no side effects, easy to test
// ============================================================
import type { BotContext, BotState, BotIntent, BotMessage } from '@/lib/types/whatsapp.types'
import { classifyIntent } from './intent-classifier'
import { R } from './responses'
import { SEED_PATIENTS, SEED_SPECIALTIES, SEED_PROFESSIONALS } from '@/lib/data/seed'

export interface EngineResult {
  newContext: BotContext
  responses: string[]    // messages to send back
  shouldEndSession: boolean
}

// ── Helpers ─────────────────────────────────────────────────

function findPatientByName(text: string) {
  const lower = text.toLowerCase()
  return SEED_PATIENTS.find(p =>
    lower.includes(p.first_name.toLowerCase()) || lower.includes(p.last_name.toLowerCase())
  )
}

function makeContext(phone: string, overrides: Partial<BotContext> = {}): BotContext {
  return {
    phone,
    patientId: null,
    patientName: null,
    pendingPhone: null,
    pendingDni: null,
    state: 'idle',
    selectedSpecialty: null,
    selectedProfessional: null,
    selectedDate: null,
    selectedTime: null,
    selectedAppointmentId: null,
    lastMessageAt: new Date().toISOString(),
    messageCount: 0,
    isKnownPatient: false,
    ...overrides,
  }
}

// ── Main state machine ───────────────────────────────────────
export function processMessage(
  incomingText: string,
  currentContext: BotContext | null,
  pushName?: string,
): EngineResult {
  const phone = currentContext?.phone ?? ''
  const ctx = currentContext ?? makeContext(phone)
  const text = incomingText.trim()
  const intent = classifyIntent(text)

  const next = { ...ctx, messageCount: ctx.messageCount + 1, lastMessageAt: new Date().toISOString() }

  // Helpers used across states
  const hasAppts = (next.upcomingAppointments?.length ?? 0) > 0

  // Global overrides
  if (text.toLowerCase() === 'menú' || text.toLowerCase() === 'menu') {
    if (next.patientName) {
      next.state = 'main_menu'
      return { newContext: next, responses: [R.mainMenu(next.patientName, hasAppts)], shouldEndSession: false }
    }
  }
  const BOOKING_STATES: BotState[] = ['booking_specialty','booking_professional','booking_date','booking_slots','booking_time','booking_confirm','cancel_select','cancel_confirm']
  if (intent === 'ask_human' && !BOOKING_STATES.includes(ctx.state)) {
    next.state = 'human_handoff'
    return { newContext: next, responses: [R.humanHandoff()], shouldEndSession: false }
  }
  if (intent === 'thanks' && !BOOKING_STATES.includes(ctx.state) && ctx.state !== 'nps_survey') {
    return { newContext: { ...next, state: 'closed' }, responses: [R.thanks()], shouldEndSession: true }
  }

  switch (ctx.state) {
    case 'idle':
    case 'closed':
    case 'greeting': {
      // route.ts pre-injects isKnownPatient/patientName/upcomingAppointments from DB
      if (ctx.isKnownPatient && ctx.patientName) {
        next.state = 'main_menu'
        return { newContext: next, responses: [R.greetingKnown(ctx.patientName), R.mainMenu(ctx.patientName, hasAppts)], shouldEndSession: false }
      }
      // Unknown patient — greet and ask name
      next.state = 'identify_patient'
      return { newContext: next, responses: [R.greeting(undefined, next.clinicName), R.askName()], shouldEndSession: false }
    }

    case 'identify_patient': {
      // Validate: at least 2 words
      const words = text.trim().split(/\s+/).filter(w => w.length > 0)
      if (words.length < 2) {
        return { newContext: next, responses: [R.askNameRetry()], shouldEndSession: false }
      }
      const fullName = words.slice(0, 3).join(' ')
      next.patientName = fullName
      next.pendingPhone = phone
      next.state = 'ask_dni'
      return { newContext: next, responses: [`¡Hola *${fullName}*! 😊`, R.askDni()], shouldEndSession: false }
    }

    case 'ask_dni': {
      const skip = ['omitir', 'skip', 'no', '-', 'no tengo'].includes(text.toLowerCase().trim())
      const digits = text.replace(/\D/g, '')
      if (!skip && (digits.length < 7 || digits.length > 9)) {
        return { newContext: next, responses: [`El DNI debe tener entre 7 y 9 dígitos. Intentá de nuevo o respondé *omitir* para saltearlo.`], shouldEndSession: false }
      }
      next.pendingDni = skip ? null : digits
      // New patient complete — route.ts saves to DB using pendingPhone + pendingDni
      next.state = 'main_menu'
      const clinicLabel = next.clinicName ?? 'Clinify'
      return {
        newContext: next,
        responses: [
          `✅ *¡Registrado correctamente!*\nYa sos parte de *${clinicLabel}*. 🦷\n\nA partir de ahora te reconocemos cada vez que escribas.`,
          R.mainMenu(next.patientName ?? '', false),
        ],
        shouldEndSession: false,
      }
    }

    case 'main_menu': {
      // Dynamic number map depending on whether patient has upcoming appointments
      const numberMap: Record<string, BotIntent> = hasAppts
        ? { '1': 'book_appointment', '2': 'cancel_appointment', '3': 'reschedule', '4': 'view_appointments' }
        : { '1': 'book_appointment', '2': 'view_appointments' }

      const resolved = numberMap[text] ?? intent

      if (resolved === 'book_appointment') {
        const specialties = next.specialties ?? SEED_SPECIALTIES.map(s => s.name)
        next.state = 'booking_specialty'
        return { newContext: next, responses: [R.selectSpecialty(specialties)], shouldEndSession: false }
      }
      if (resolved === 'cancel_appointment') {
        const appts = next.upcomingAppointments ?? []
        if (!appts.length) {
          next.state = 'no_appointments'
          return { newContext: next, responses: [R.noAppointments()], shouldEndSession: false }
        }
        next.state = 'cancel_select'
        return { newContext: next, responses: [R.cancelSelect(appts)], shouldEndSession: false }
      }
      if (resolved === 'view_appointments') {
        const appts = next.upcomingAppointments ?? []
        if (!appts.length) {
          next.state = 'no_appointments'
          return { newContext: next, responses: [R.noAppointments()], shouldEndSession: false }
        }
        next.state = 'view_appointments'
        const msg = R.showAppointments(appts) + '\n\n1️⃣ Cancelar un turno\n2️⃣ Reprogramar un turno\n3️⃣ Volver al menú'
        return { newContext: next, responses: [msg], shouldEndSession: false }
      }
      if (resolved === 'reschedule') {
        const appts = next.upcomingAppointments ?? []
        if (!appts.length) {
          next.state = 'no_appointments'
          return { newContext: next, responses: [R.noAppointments()], shouldEndSession: false }
        }
        next.state = 'reschedule'
        if (appts.length === 1) {
          const a = appts[0]
          next.selectedAppointmentId = a.id
          next.selectedDate = a.date
          next.selectedTime = a.time
          return { newContext: next, responses: [`Vamos a reprogramar tu turno del *${a.date}* a las *${a.time}* con *${a.professional}*.\n\nPrimero lo cancelamos y luego elegís uno nuevo. ¿Continuamos?\n\n1️⃣ Sí\n2️⃣ No, volver al menú`], shouldEndSession: false }
        }
        const list = appts.map((a, i) => `${i + 1}️⃣ ${a.date} ${a.time} - ${a.professional}`).join('\n')
        return { newContext: next, responses: [`¿Cuál turno querés reprogramar?\n\n${list}\n\nRespondé con el número.`], shouldEndSession: false }
      }
      if (resolved === 'ask_human') {
        next.state = 'human_handoff'
        return { newContext: next, responses: [R.humanHandoff()], shouldEndSession: false }
      }
      // Invalid — re-send menu
      return { newContext: next, responses: [`Opción inválida. ` + R.mainMenu(next.patientName ?? '', hasAppts)], shouldEndSession: false }
    }

    case 'no_appointments': {
      const t = text.toLowerCase().trim()
      if (['1', 'si', 'sí', 's', 'dale', 'ok'].includes(t)) {
        const specialties = next.specialties ?? SEED_SPECIALTIES.map(s => s.name)
        next.state = 'booking_specialty'
        return { newContext: next, responses: [R.selectSpecialty(specialties)], shouldEndSession: false }
      }
      if (['2', 'no', 'nop', 'gracias', 'no gracias'].includes(t)) {
        next.state = 'closed'
        return { newContext: next, responses: [R.noAppointmentsFarewell()], shouldEndSession: true }
      }
      return { newContext: next, responses: [`Respondé *1* para sacar un turno o *2* para salir.`], shouldEndSession: false }
    }

    case 'booking_specialty': {
      const specList = ctx.specialties ?? SEED_SPECIALTIES.map(s => s.name)
      const idx = parseInt(text) - 1
      const specialtyName = specList[idx]
      if (!specialtyName) {
        return { newContext: next, responses: [`Opción inválida. ` + R.selectSpecialty(specList)], shouldEndSession: false }
      }
      next.selectedSpecialty = specialtyName
      next.state = 'booking_professional'
      const profs = ctx.professionals ?? SEED_PROFESSIONALS.map(p => p.full_name)
      return { newContext: next, responses: [R.selectProfessional(profs)], shouldEndSession: false }
    }

    case 'booking_professional': {
      const profs = ctx.professionals ?? SEED_PROFESSIONALS.map(p => p.full_name)
      const lower = text.toLowerCase()
      const isNoPreference = text === '0' ||
        lower.includes('sin') || lower.includes('preferencia') ||
        lower.includes('cualquiera') || lower.includes('indistinto')
      const idx = parseInt(text) - 1
      const profName = (!isNoPreference && idx >= 0 && idx < profs.length) ? profs[idx] : null
      if (!isNoPreference && profName === null) {
        return { newContext: next, responses: [`Opción inválida. ` + R.selectProfessional(profs)], shouldEndSession: false }
      }
      next.selectedProfessional = profName ?? 'Sin preferencia'
      next.state = 'booking_date'
      // Signal route.ts to fetch available dates
      return { newContext: next, responses: ['__FETCH_DATES__'], shouldEndSession: false }
    }

    case 'booking_date': {
      const dates = ctx.availableDatesList ?? []
      if (dates.length === 0) {
        return { newContext: next, responses: ['__FETCH_DATES__'], shouldEndSession: false }
      }
      const idx = parseInt(text) - 1
      const dateEntry = dates[idx]
      if (!dateEntry || isNaN(idx)) {
        const list = dates.map((d, i) => `${i + 1}️⃣ ${d.label}`).join('\n')
        return { newContext: next, responses: [`Opción inválida. Elegí un número:\n\n${list}`], shouldEndSession: false }
      }
      next.selectedDate = dateEntry.date
      next.availableDatesList = undefined
      next.state = 'booking_slots'
      return { newContext: next, responses: ['__FETCH_SLOTS__'], shouldEndSession: false }
    }

    case 'booking_slots': {
      const slots = ctx.availableSlotsList ?? []
      if (slots.length === 0) {
        next.state = 'booking_date'
        next.availableDatesList = undefined
        return { newContext: next, responses: ['__FETCH_DATES__'], shouldEndSession: false }
      }
      const idx = parseInt(text) - 1
      const slot = slots[idx]
      if (!slot || isNaN(idx)) {
        const list = slots.map((s, i) => `${i + 1}️⃣ ${s.label}`).join('\n')
        return { newContext: next, responses: [`Opción inválida. Elegí un número:\n\n${list}`], shouldEndSession: false }
      }
      next.selectedDate = slot.date
      next.selectedTime = slot.time
      next.state = 'booking_confirm'
      return { newContext: next, responses: [R.confirmBooking(next, slot.date, slot.time)], shouldEndSession: false }
    }

    case 'booking_confirm': {
      const t = text.toLowerCase().trim()
      const isConfirm = ['1','si','sí','s','ok','dale','confirmo','confirmar','correcto','de acuerdo','claro','ya'].includes(t)
      const isDeny    = ['2','no','nop','nel','cancelar','atrás','atras','volver'].includes(t)
      if (isConfirm) {
        next.state = 'booking_done'
        return { newContext: next, responses: [R.bookingSuccess(next.selectedDate!, next.selectedTime!, next.clinicName)], shouldEndSession: false }
      }
      if (isDeny) {
        next.state = 'main_menu'
        return { newContext: next, responses: [R.bookingCancelled()], shouldEndSession: false }
      }
      return { newContext: next, responses: [R.confirmBooking(next, next.selectedDate!, next.selectedTime!)], shouldEndSession: false }
    }

    case 'cancel_select': {
      const appts = next.upcomingAppointments ?? []
      const idx = parseInt(text) - 1
      const appt = appts[idx]
      if (!appt || isNaN(idx)) {
        return { newContext: next, responses: [`Elegí un número del 1 al ${appts.length}.\n\n` + R.cancelSelect(appts)], shouldEndSession: false }
      }
      next.selectedDate = appt.date
      next.selectedTime = appt.time
      next.selectedAppointmentId = appt.id
      next.state = 'cancel_confirm'
      return { newContext: next, responses: [R.cancelConfirm(appt.date, appt.time)], shouldEndSession: false }
    }

    case 'cancel_confirm': {
      const t = text.toLowerCase().trim()
      const isConfirm = ['1','si','sí','s','ok','dale','confirmo'].includes(t)
      const isDeny    = ['2','no','nop','nel','atrás','atras','volver'].includes(t)
      if (isConfirm) {
        next.state = 'main_menu'
        return { newContext: next, responses: [R.cancelSuccess()], shouldEndSession: false }
      }
      if (isDeny) {
        next.state = 'main_menu'
        return { newContext: next, responses: ['Cancelación abortada. ¿Algo más?'], shouldEndSession: false }
      }
      return { newContext: next, responses: [R.cancelConfirm(next.selectedDate!, next.selectedTime!)], shouldEndSession: false }
    }

    case 'reschedule': {
      // If selectedAppointmentId is set: confirmation step (1=yes, 2=no)
      if (next.selectedAppointmentId) {
        const t = text.toLowerCase().trim()
        if (['1','si','sí','s','ok','dale'].includes(t)) {
          // Cancel old appointment (route.ts detects this transition and calls cancelAppointmentFromBot)
          const specialties = next.specialties ?? SEED_SPECIALTIES.map(s => s.name)
          next.state = 'booking_specialty'
          return { newContext: next, responses: [`✅ Turno anterior cancelado. Ahora elegí la nueva especialidad:\n\n` + R.selectSpecialty(specialties)], shouldEndSession: false }
        }
        if (['2','no','nop','nel','volver'].includes(t)) {
          next.state = 'main_menu'
          next.selectedAppointmentId = null
          return { newContext: next, responses: ['Entendido, tu turno no fue modificado.'], shouldEndSession: false }
        }
        return { newContext: next, responses: ['Respondé *1* para continuar con la reprogramación o *2* para volver al menú.'], shouldEndSession: false }
      }
      // Selection step: patient has multiple appointments, pick which one
      const appts = next.upcomingAppointments ?? []
      if (!appts.length) {
        next.state = 'no_appointments'
        return { newContext: next, responses: [R.noAppointments()], shouldEndSession: false }
      }
      const idx = parseInt(text) - 1
      const appt = appts[idx]
      if (!appt || isNaN(idx)) {
        const list = appts.map((a, i) => `${i + 1}️⃣ ${a.date} ${a.time} - ${a.professional}`).join('\n')
        return { newContext: next, responses: [`Elegí un número del 1 al ${appts.length}:\n\n${list}`], shouldEndSession: false }
      }
      next.selectedAppointmentId = appt.id
      next.selectedDate = appt.date
      next.selectedTime = appt.time
      return { newContext: next, responses: [`Vamos a reprogramar tu turno del *${appt.date}* a las *${appt.time}* con *${appt.professional}*.\n\nPrimero lo cancelamos y luego elegís uno nuevo. ¿Continuamos?\n\n1️⃣ Sí\n2️⃣ No, volver al menú`], shouldEndSession: false }
    }

    case 'view_appointments': {
      const appts = next.upcomingAppointments ?? []
      const t = text.toLowerCase().trim()
      if (['1', 'cancelar'].includes(t)) {
        if (!appts.length) {
          next.state = 'no_appointments'
          return { newContext: next, responses: [R.noAppointments()], shouldEndSession: false }
        }
        next.state = 'cancel_select'
        return { newContext: next, responses: [R.cancelSelect(appts)], shouldEndSession: false }
      }
      if (['2', 'reprogramar'].includes(t)) {
        if (!appts.length) {
          next.state = 'no_appointments'
          return { newContext: next, responses: [R.noAppointments()], shouldEndSession: false }
        }
        next.state = 'reschedule'
        if (appts.length === 1) {
          const a = appts[0]
          next.selectedAppointmentId = a.id
          next.selectedDate = a.date
          next.selectedTime = a.time
          return { newContext: next, responses: [`Vamos a reprogramar tu turno del *${a.date}* a las *${a.time}* con *${a.professional}*.\n\nPrimero lo cancelamos y luego elegís uno nuevo. ¿Continuamos?\n\n1️⃣ Sí\n2️⃣ No, volver al menú`], shouldEndSession: false }
        }
        const list = appts.map((a, i) => `${i + 1}️⃣ ${a.date} ${a.time} - ${a.professional}`).join('\n')
        return { newContext: next, responses: [`¿Cuál turno querés reprogramar?\n\n${list}\n\nRespondé con el número.`], shouldEndSession: false }
      }
      if (['3', 'menú', 'menu', 'volver'].includes(t)) {
        next.state = 'main_menu'
        return { newContext: next, responses: [R.mainMenu(next.patientName ?? '', hasAppts)], shouldEndSession: false }
      }
      const msg = `Respondé con:\n*1* para cancelar\n*2* para reprogramar\n*3* para volver al menú`
      return { newContext: next, responses: [msg], shouldEndSession: false }
    }

    case 'nps_survey': {
      const score = parseInt(text)
      if (!isNaN(score) && score >= 0 && score <= 10) {
        next.state = 'closed'
        return { newContext: next, responses: [R.npsThanks(score)], shouldEndSession: true }
      }
      return { newContext: next, responses: ['Por favor respondé con un número del 0 al 10.'], shouldEndSession: false }
    }

    default: {
      // Stale or removed state — reset to idle and greet again
      next.state = 'idle'
      if (next.isKnownPatient && next.patientName) {
        next.state = 'main_menu'
        return { newContext: next, responses: [R.greetingKnown(next.patientName), R.mainMenu(next.patientName, hasAppts)], shouldEndSession: false }
      }
      return { newContext: next, responses: [R.greeting(undefined, next.clinicName), R.askName()], shouldEndSession: false }
    }
  }
}

export function createInitialContext(phone: string): BotContext {
  return makeContext(phone)
}

// Build a BotMessage record
export function makeMessage(
  direction: 'inbound' | 'outbound',
  text: string,
  phone: string,
  state?: BotState,
  intent?: BotIntent,
): BotMessage {
  return {
    id: crypto.randomUUID(),
    phone,
    direction,
    text,
    timestamp: new Date().toISOString(),
    botState: state,
    intent,
  }
}
