import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server-admin'

async function getProfile() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('organization_id, role').eq('id', user.id).single()
  return profile
}

// GET — read AI config from organization settings
export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('settings').eq('id', profile.organization_id).single()

  const ai = (org?.settings as Record<string, unknown> | null)?.ai ?? {}
  return NextResponse.json(ai)
}

// PUT — save AI config to organization settings
export async function PUT(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'owner' && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admins pueden configurar la IA' }, { status: 403 })
  }

  const body = await req.json()
  const { provider, apiKey, model } = body

  if (!provider) {
    return NextResponse.json({ error: 'Falta provider' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get current settings
  const { data: org } = await admin.from('organizations').select('settings').eq('id', profile.organization_id).single()
  const currentSettings = (org?.settings as Record<string, unknown>) ?? {}
  const currentAi = (currentSettings.ai as Record<string, unknown> | undefined) ?? {}

  // If apiKey not provided, keep the existing one
  const finalApiKey = apiKey || (currentAi.apiKey as string)
  if (!finalApiKey) {
    return NextResponse.json({ error: 'Falta apiKey (no hay una guardada)' }, { status: 400 })
  }

  // Merge AI config
  const updatedSettings = {
    ...currentSettings,
    ai: { provider, apiKey: finalApiKey, model: model || currentAi.model || 'gpt-4o' },
  }

  const { error } = await admin
    .from('organizations')
    .update({ settings: updatedSettings })
    .eq('id', profile.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
