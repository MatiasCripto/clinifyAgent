import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server-admin'

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'clinify'

export async function GET(req: NextRequest) {
  // Auth check — must be authenticated with a profile
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const instance = req.nextUrl.searchParams.get('instance') ?? DEFAULT_INSTANCE
  try {
    const res = await fetch(`${BASE_URL}/instance/connectionState/${instance}`, {
      headers: { apikey: API_KEY },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ state: 'close' })
    const data = await res.json()
    // Evolution v2: { instance: { instanceName, state } }
    const state: string = data?.instance?.state ?? data?.state ?? 'close'
    return NextResponse.json({ state, instance })
  } catch {
    return NextResponse.json({ state: 'close', instance })
  }
}
