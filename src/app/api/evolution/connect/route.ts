import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { createServiceClient } from '@/lib/supabase/service'

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? ''
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'clinify'

async function requireAdminRole(): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return !!profile && ['superadmin', 'owner', 'admin'].includes(profile.role)
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminRole())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const instance: string = body.instance ?? DEFAULT_INSTANCE
  const clinicId: string | undefined = body.clinic_id

  // Get the webhook URL for this app
  // Evolution runs in Docker, so localhost won't reach the host — use host.docker.internal
  const appUrl = (req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001')
    .replace(/localhost/g, 'host.docker.internal')
  const webhookUrl = `${appUrl}/api/webhooks/whatsapp`

  // Helper: configure webhook in Evolution
  async function configureWebhook() {
    try {
      await fetch(`${BASE_URL}/webhook/set/${instance}`, {
        method: 'POST',
        headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhook_by_events: false,
          events: ['MESSAGES_UPSERT'],
        }),
      })
    } catch { /* non-blocking */ }
  }

  // Save instance ↔ clinic association so the bot knows which clinic to use
  async function linkClinic() {
    if (!clinicId) return
    try {
      const sb = createServiceClient()
      // Clear any previous association of this instance with other clinics
      await sb.from('clinics').update({ evolution_instance: null }).eq('evolution_instance', instance)
      // Set this clinic as the owner
      await sb.from('clinics').update({ evolution_instance: instance }).eq('id', clinicId)
    } catch { /* non-critical */ }
  }

  // 1. Try to connect existing instance → returns QR if not yet connected
  const connectRes = await fetch(`${BASE_URL}/instance/connect/${instance}`, {
    headers: { apikey: API_KEY },
    cache: 'no-store',
  })

  if (connectRes.ok) {
    const data = await connectRes.json()
    await configureWebhook()
    await linkClinic()
    return NextResponse.json(data)
  }

  // 2. Instance doesn't exist → create it
  const createRes = await fetch(`${BASE_URL}/instance/create`, {
    method: 'POST',
    headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instanceName: instance,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })

  if (!createRes.ok) {
    return NextResponse.json({ error: 'No se pudo crear la instancia' }, { status: 502 })
  }

  await configureWebhook()
  await linkClinic()

  const created = await createRes.json()
  return NextResponse.json(created)
}
