import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyJobAuth, jobUnauthorized, sendWithRetry, logAutomation, isAlreadyProcessed } from '../_helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface NpsAppointment {
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

const DELAY_HOURS = 2 // Wait 2h after appointment before sending NPS

export async function GET(request: Request) {
  if (!verifyJobAuth(request)) return jobUnauthorized()

  const sb = createServiceClient()
  const now = new Date()
  const delayMs = DELAY_HOURS * 60 * 60 * 1000
  const windowStart = new Date(now.getTime() - delayMs - 30 * 60 * 1000) // -2h30m
  const windowEnd = new Date(now.getTime() - delayMs) // -2h

  const { data: appointments, error } = await sb
    .from('appointments')
    .select('id, patient_id, professional_id, clinic_id, organization_id, starts_at, treatment, patients(first_name, phone), professionals(full_name)')
    .eq('status', 'completed')
    .eq('nps_sent', false)
    .gte('starts_at', windowStart.toISOString())
    .lte('starts_at', windowEnd.toISOString())
    .order('starts_at')

  if (error || !appointments) {
    return NextResponse.json({ error: error?.message ?? 'No data' }, { status: 500 })
  }

  const jobs = appointments as unknown as NpsAppointment[]
  let processed = 0
  let failed = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const appt of jobs) {
    if (await isAlreadyProcessed(appt.id, 'post-appointment-nps')) {
      processed++
      continue
    }

    const phone = appt.patients?.phone
    if (!phone) {
      await logAutomation({
        clinicId: appt.clinic_id,
        organizationId: appt.organization_id,
        jobType: 'post-appointment-nps',
        entityType: 'appointment',
        entityId: appt.id,
        status: 'skipped',
        payload: { reason: 'no_phone' },
      })
      continue
    }

    const name = appt.patients?.first_name ?? 'Paciente'
    const prof = appt.professionals?.full_name ?? 'el profesional'

    const message = `¡Hola ${name}! 😊\n\n¿Cómo te fue hoy en tu consulta de ${appt.treatment ?? 'consulta'} con ${prof}?\n\nDel 1 al 10, ¿qué puntaje le darías a tu experiencia?\n\n(10 = excelente, 1 = muy mala)\n\n¡Tu opinión nos ayuda a mejorar! 🙏`

    const result = await sendWithRetry(phone, message)

    await logAutomation({
      clinicId: appt.clinic_id,
      organizationId: appt.organization_id,
      jobType: 'post-appointment-nps',
      entityType: 'appointment',
      entityId: appt.id,
      status: result.ok ? 'success' : 'failed',
      payload: { phone, treatment: appt.treatment },
      error: result.error,
    })

    if (result.ok) {
      await sb.from('appointments').update({ nps_sent: true }).eq('id', appt.id)
      processed++
    } else {
      failed++
      errors.push({ id: appt.id, error: result.error ?? 'unknown' })
    }
  }

  return NextResponse.json({
    job: 'post-appointment-nps',
    processed,
    failed,
    total: jobs.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
