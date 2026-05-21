// ── Automation job helpers ────────────────────────────────
// Shared by all /api/jobs/* routes.
// Server-only — never imported in client code.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendText } from '@/lib/bot/evolution-client'

// ── Auth ───────────────────────────────────────────────────

export function verifyJobAuth(request: Request): boolean {
  const secret = process.env.JOB_SECRET
  if (!secret) return true // no secret configured = allow (dev mode)
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  return token === secret
}

export function jobUnauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// ── Retry with exponential backoff ─────────────────────────

export async function sendWithRetry(
  phone: string,
  message: string,
  maxRetries = 3,
): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await sendText(phone, message, 1200)
      return { ok: true }
    } catch (err) {
      const msg = String(err)
      if (attempt === maxRetries - 1) return { ok: false, error: msg }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
  return { ok: false, error: 'max retries exceeded' }
}

// ── Logging ───────────────────────────────────────────────

export async function logAutomation(params: {
  clinicId?: string
  organizationId?: string
  jobType: string
  entityType: string
  entityId?: string
  status: 'success' | 'failed' | 'skipped'
  payload?: Record<string, unknown>
  error?: string
}) {
  try {
    const sb = createServiceClient()
    await sb.from('automation_logs').insert({
      clinic_id: params.clinicId ?? null,
      workflow: params.jobType,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      status: params.status,
      payload: params.payload ?? null,
      error: params.error ?? null,
      executed_at: new Date().toISOString(),
    })
  } catch {
    // Non-critical — don't crash the job if logging fails
    console.error('[Job] Failed to write automation_log')
  }
}

// ── Dedup check ────────────────────────────────────────────
// Prevent double-processing the same appointment for the same job

export async function isAlreadyProcessed(
  appointmentId: string,
  jobType: string,
): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('automation_logs')
      .select('id')
      .eq('entity_id', appointmentId)
      .eq('workflow', jobType)
      .eq('status', 'success')
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}

// ── Fallback env vars ──────────────────────────────────────

export const EVOLUTION_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
export const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY ?? ''
export const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'clinify'
export const JOB_SECRET = process.env.JOB_SECRET ?? ''
