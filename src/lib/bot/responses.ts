// Bot response templates in Spanish (Argentina)
// All messages use WhatsApp-compatible formatting

import type { BotContext } from '@/lib/types/whatsapp.types'

export const R = {
  greeting: (name?: string, clinicName = 'Clinify') =>
    `¡Hola${name ? ` ${name}` : ''}! 👋 Bienvenido/a a *${clinicName}*.\n\nSoy el asistente virtual de la clínica.`,

  greetingKnown: (name: string) =>
    `¡Hola ${name}! 😊 ¿En qué puedo ayudarte hoy?`,

  mainMenu: (name: string, hasAppointments = false) =>
    hasAppointments
      ? `¿En qué puedo ayudarte, ${name}? 😊\n\n1️⃣ Sacar turno\n2️⃣ Cancelar turno\n3️⃣ Reprogramar turno\n4️⃣ Ver mis próximos turnos\n\nRespondé con el número de la opción.`
      : `¿En qué puedo ayudarte, ${name}? 😊\n\n1️⃣ Sacar turno\n2️⃣ Ver mis próximos turnos\n\nRespondé con el número de la opción.`,

  askName: () =>
    `Para ayudarte mejor, ¿me podés decir tu *nombre y apellido*? 😊\n\n_(Por ejemplo: _María González_)_`,

  askNameRetry: () =>
    `Necesito tu *nombre y apellido completo* para registrarte. Por favor escribí las dos palabras. 😊\n\n_(Por ejemplo: _Carlos Pérez_)_`,

  askPhone: () =>
    `¿Cuál es tu *número de teléfono*? 📱\n\nEscribilo con código de área, sin espacios.\n_(Por ejemplo: 3514400000)_`,

  askPhoneRetry: () =>
    `El número no parece válido. Por favor escribí solo los dígitos, con código de área.\n_(Por ejemplo: 3514400000)_`,

  askDni: () =>
    `¿Cuál es tu *DNI*? 🪪\n\nEscribí solo el número, sin puntos.\n_(Si preferís, respondé *omitir* para saltear este paso)_`,

  patientNotFound: () =>
    `No encontré una cuenta con ese dato. ¿Sos paciente nuevo?\n\n1️⃣ Sí, soy nuevo\n2️⃣ Intentar con otro dato`,

  newPatientWelcome: () =>
    `¡Genial! Vamos a crear tu perfil 🎉\n\nPor favor enviá:\n• Tu nombre y apellido\n• Tu número de teléfono\n• Tu email (opcional)`,

  selectSpecialty: (specialties: string[]) => {
    const list = specialties.map((s, i) => `${i + 1}️⃣ ${s}`).join('\n')
    return `¿Qué tipo de consulta necesitás?\n\n${list}\n\nRespondé con el número.`
  },

  selectProfessional: (professionals: string[]) => {
    const list = professionals.map((p, i) => `${i + 1}️⃣ ${p}`).join('\n')
    return `¿Con qué profesional preferís atenderte?\n\n${list}\n\n0️⃣ Sin preferencia\n\nRespondé con el número.`
  },

  selectDate: () =>
    `¿Para qué fecha querés el turno? Enviá la fecha en formato *DD/MM* o elegí:\n\n1️⃣ Mañana\n2️⃣ Esta semana\n3️⃣ Próxima semana`,

  selectTime: (slots: string[]) => {
    const list = slots.map((s, i) => `${i + 1}️⃣ ${s}`).join('\n')
    return `Horarios disponibles para esa fecha:\n\n${list}\n\nElegí un horario.`
  },

  confirmBooking: (ctx: BotContext, date: string, time: string) =>
    `📋 *Confirmación de turno*\n\nPaciente: ${ctx.patientName}\nEspecialidad: ${ctx.selectedSpecialty}\nProfesional: ${ctx.selectedProfessional}\nFecha: ${date}\nHorario: ${time}\n\n¿Confirmás el turno?\n\n✅ Responde *SÍ* para confirmar\n❌ Responde *NO* para cancelar`,

  bookingSuccess: (date: string, time: string, clinicName = 'Clinify') =>
    `✅ *¡Turno confirmado!*\n\n📅 Fecha: ${date}\n🕐 Hora: ${time}\n📍 ${clinicName}\n\nTe vamos a enviar un recordatorio 24hs antes. ¡Nos vemos! 😊`,

  bookingCancelled: () =>
    `Entendido, el turno no fue agendado. ¿Puedo ayudarte con algo más? (Respondé *MENÚ* para volver al inicio)`,

  noAppointments: () =>
    `No encontré turnos próximos para vos. ¿Querés sacar uno ahora?\n\n1️⃣ Sí, sacar turno\n2️⃣ No, gracias`,

  noAppointmentsFarewell: () =>
    `¡Hasta pronto! 😊 Si necesitás algo, escribinos cuando quieras.`,

  showAppointments: (appointments: Array<{ date: string; time: string; professional: string; specialty: string }>) => {
    const list = appointments
      .map((a, i) => `${i + 1}. 📅 ${a.date} ${a.time} — ${a.professional} (${a.specialty})`)
      .join('\n')
    return `📋 *Tus próximos turnos:*\n\n${list}\n\n¿Querés cancelar o reprogramar alguno?`
  },

  cancelSelect: (appointments: Array<{ date: string; time: string; professional: string }>) => {
    const list = appointments.map((a, i) => `${i + 1}️⃣ ${a.date} ${a.time} - ${a.professional}`).join('\n')
    return `¿Cuál turno querés cancelar?\n\n${list}\n\nRespondé con el número.`
  },

  cancelConfirm: (date: string, time: string) =>
    `¿Confirmás la cancelación del turno del *${date}* a las *${time}*?\n\n✅ SÍ — ❌ NO`,

  cancelSuccess: () =>
    `✅ Tu turno fue cancelado correctamente. Podés sacar uno nuevo cuando quieras. 😊`,

  humanHandoff: () =>
    `Entendido, te voy a conectar con un agente humano. Un momento por favor... 👥\n\nNuestro horario de atención es *Lunes a Viernes 8:00 - 18:00hs*.\nSi estás fuera de ese horario, te respondemos a la brevedad.`,

  npsQuestion: () =>
    `Hola! ¿Cómo fue tu experiencia en nuestra última consulta? 🦷\n\nDel *0 al 10*, ¿cuánto nos recomendarías a un amigo?\n\n_(0 = Nada probable · 10 = Muy probable)_`,

  npsThanks: (score: number) => {
    if (score >= 9) return `¡Muchas gracias! 🎉 Nos alegra mucho que hayas tenido una gran experiencia. ¡Hasta la próxima!`
    if (score >= 7) return `¡Gracias por tu respuesta! 😊 Seguimos trabajando para mejorar. ¡Hasta pronto!`
    return `Gracias por tu honestidad. Lamentamos no haber cumplido tus expectativas. Un agente se va a comunicar con vos pronto. 🙏`
  },

  thanks: () =>
    `¡De nada! 😊 Si necesitás algo más, escribinos cuando quieras. ¡Hasta pronto!`,

  unknown: () =>
    `No entendí tu mensaje. 😅\n\nPodés escribir *MENÚ* para ver las opciones disponibles, o *AGENTE* para hablar con una persona.`,

  outOfHours: () =>
    `¡Hola! 🌙 Estamos fuera del horario de atención.\n\nNuestro horario es *Lunes a Viernes de 8:00 a 18:00hs*.\n\nDejanos tu mensaje y te respondemos a la brevedad. ¡Gracias! 😊`,

  typing: () => '...',
}
