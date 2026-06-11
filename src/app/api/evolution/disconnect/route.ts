import { NextRequest, NextResponse } from 'next/server'
import { getAuthProfile } from '@/lib/supabase/get-profile'
import { checkRateLimit } from '@/lib/utils/rate-limit'

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'clinify'

async function requireAdminRole(): Promise<boolean> {
  const auth = await getAuthProfile()
  if (!auth) return false
  return ['superadmin', 'owner', 'admin'].includes(auth.profile.role)
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const rl = checkRateLimit(`evolution:disconnect:${ip}`, { windowMs: 60_000, maxHits: 10 })
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (!(await requireAdminRole())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const instance: string = body.instance ?? DEFAULT_INSTANCE

  try {
    await fetch(`${BASE_URL}/instance/logout/${instance}`, {
      method: 'DELETE',
      headers: { apikey: API_KEY },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al desconectar' }, { status: 502 })
  }
}
