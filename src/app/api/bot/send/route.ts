import { NextRequest, NextResponse } from 'next/server'
import { getAuthProfile } from '@/lib/supabase/get-profile'
import { sendText } from '@/lib/bot/evolution-client'
import { checkRateLimit } from '@/lib/utils/rate-limit'

export async function POST(req: NextRequest) {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, profile } = auth

  if (!['superadmin', 'owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit: 10 req/min per user
  const rl = checkRateLimit(`bot:send:${user.id}`, { windowMs: 60_000, maxHits: 10 })
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { phone, message } = await req.json()

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400 })
  }

  try {
    await sendText(phone, message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
