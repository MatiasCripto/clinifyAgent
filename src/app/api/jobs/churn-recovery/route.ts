import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyJobAuth, jobUnauthorized, sendWithRetry, logAutomation, isAlreadyProcessed } from '../_helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ChurnPatient {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  organization_id: string
  clinic_id: string | null
}

const COOLDOWN_DAYS = 30 // Don't send another recovery campaign for 30 days

export async function GET(request: Request) {
  if (!verifyJobAuth(request)) return jobUnauthorized()

  const sb = createServiceClient()
  const cooldownDate = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000)

  // Find patients with high churn risk who haven't been contacted recently
  const { data: patients, error } = await sb
    .from('patients')
    .select(`
      id, first_name, last_name, phone, organization_id,
      clinics!patients_clinic_id_fkey(id, organization_id)
    `)
    .eq('is_active', true)
    .not('phone', 'is', null)
    .order('last_name')

  if (error || !patients) {
    return NextResponse.json({ error: error?.message ?? 'No data' }, { status: 500 })
  }

  // Get all appointments for scoring context
  const { data: allAppointments } = await sb
    .from('appointments')
    .select('patient_id, starts_at, status')
    .not('status', 'eq', 'cancelled')
    .order('starts_at', { ascending: false })

  // Get patient scores
  const { data: scores } = await sb
    .from('patient_scores')
    .select('patient_id, churn_risk, recency_days, last_appointment_date')

  // Build patientId → score map
  const scoreMap = new Map<string, { churn_risk: string; recency_days: number; last_appt: string | null }>()
  for (const s of (scores ?? [])) {
    scoreMap.set(s.patient_id, { churn_risk: s.churn_risk, recency_days: s.recency_days, last_appt: s.last_appointment_date })
  }

  // Filter: churn risk high + no future appointments
  const candidates: ChurnPatient[] = []
  for (const p of (patients as unknown as Array<{ id: string; first_name: string; last_name: string; phone: string | null; organization_id: string; clinics: Array<{ id: string; organization_id: string }> | null }>)) {
    const score = scoreMap.get(p.id)
    if (!score || (score.churn_risk !== 'high' && score.churn_risk !== 'churned')) continue

    // Check for future appointments
    const hasFuture = (allAppointments ?? []).some(
      a => a.patient_id === p.id && new Date(a.starts_at) > new Date()
    )
    if (hasFuture) continue

    candidates.push({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone,
      organization_id: p.organization_id,
      clinic_id: p.clinics?.[0]?.id ?? null,
    })
  }

  if (candidates.length === 0) {
    return NextResponse.json({ job: 'churn-recovery', processed: 0, failed: 0, total: 0, message: 'No candidates' })
  }

  // Limit to 20 per run to avoid spam
  const batch = candidates.slice(0, 20)
  let processed = 0
  let failed = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const patient of batch) {
    if (await isAlreadyProcessed(patient.id, 'churn-recovery')) {
      // Check cooldown — only re-send if last successful send was >30 days ago
      const { data: lastLog } = await sb
        .from('automation_logs')
        .select('executed_at')
        .eq('entity_id', patient.id)
        .eq('workflow', 'churn-recovery')
        .eq('status', 'success')
        .order('executed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastLog && new Date(lastLog.executed_at) > cooldownDate) {
        continue // Still in cooldown
      }
    }

    if (!patient.phone) continue

    const name = patient.first_name
    const message = `¡Hola ${name}! 👋\n\nHace un tiempo que no te vemos por la clínica y queríamos saber cómo estás.\n\nSi necesitás sacar un turno, podemos ayudarte por acá mismo. Respondé este mensaje y te agendamos sin vueltas.\n\n¡Te extrañamos! 😊`

    const result = await sendWithRetry(patient.phone, message)

    await logAutomation({
      clinicId: patient.clinic_id ?? undefined,
      organizationId: patient.organization_id,
      jobType: 'churn-recovery',
      entityType: 'patient',
      entityId: patient.id,
      status: result.ok ? 'success' : 'failed',
      payload: { patient_name: `${patient.first_name} ${patient.last_name}` },
      error: result.error,
    })

    if (result.ok) {
      processed++
    } else {
      failed++
      errors.push({ id: patient.id, error: result.error ?? 'unknown' })
    }
  }

  return NextResponse.json({
    job: 'churn-recovery',
    processed,
    failed,
    total: batch.length,
    candidatesFound: candidates.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
