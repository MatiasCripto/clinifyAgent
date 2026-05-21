import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyJobAuth, jobUnauthorized, sendWithRetry, logAutomation, isAlreadyProcessed } from '../_helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ReminderAppointment {
  id: string
  patient_id: string
  professional_id: string
  clinic_id: string
  organization_id: string
  starts_at: string
  treatment: string
  patients: { first_name: string; phone: string | null } | null
  professionals: { full_name: string } | null
}

export async function GET(request: Request) {
  if (!verifyJobAuth(request)) return jobUnauthorized()

  const sb = createServiceClient()
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in24h30m = new Date(now.getTime() + 24.5 * 60 * 60 * 1000)

  // Fetch appointments starting in 24-24.5h, confirmed, not reminded yet
  const { data: appointments, error } = await sb
    .from('appointments')
    .select('id, patient_id, professional_id, clinic_id, organization_id, starts_at, treatment, patients(first_name, phone), professionals(full_name)')
    .eq('status', 'confirmed')
    .eq('reminder_sent', false)
    .gte('starts_at', in24h.toISOString())
    .lte('starts_at', in24h30m.toISOString())
    .order('starts_at')

  if (error || !appointments) {
    return NextResponse.json({ error: error?.message ?? 'No data' }, { status: 500 })
  }

  const jobs = appointments as unknown as ReminderAppointment[]
  let processed = 0
  let failed = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const appt of jobs) {
    // Skip if already processed (idempotency)
    if (await isAlreadyProcessed(appt.id, 'reminder-24h')) {
      processed++
      continue
    }

    const phone = appt.patients?.phone
    if (!phone) {
      await logAutomation({
        clinicId: appt.clinic_id,
        organizationId: appt.organization_id,
        jobType: 'reminder-24h',
        entityType: 'appointment',
        entityId: appt.id,
        status: 'skipped',
        payload: { reason: 'no_phone' },
      })
      continue
    }

    const time = new Date(appt.starts_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const date = new Date(appt.starts_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    const name = appt.patients?.first_name ?? 'Paciente'
    const prof = appt.professionals?.full_name ?? 'el profesional'

    const message = `¡Hola ${name}! 😊\n\nTe recuerdo que mañana ${date} a las ${time} tenés turno de ${appt.treatment ?? 'consulta'} con ${prof}.\n\nSi necesitás cancelar o reprogramar, avisanos. ¡Te esperamos!`

    const result = await sendWithRetry(phone, message)

    await logAutomation({
      clinicId: appt.clinic_id,
      organizationId: appt.organization_id,
      jobType: 'reminder-24h',
      entityType: 'appointment',
      entityId: appt.id,
      status: result.ok ? 'success' : 'failed',
      payload: { phone, treatment: appt.treatment, starts_at: appt.starts_at },
      error: result.error,
    })

    if (result.ok) {
      // Mark reminder_sent only on success
      await sb.from('appointments').update({ reminder_sent: true }).eq('id', appt.id)
      processed++
    } else {
      failed++
      errors.push({ id: appt.id, error: result.error ?? 'unknown' })
    }
  }

  return NextResponse.json({
    job: 'reminder-24h',
    processed,
    failed,
    total: jobs.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
