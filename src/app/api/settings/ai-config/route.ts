import { NextRequest, NextResponse } from 'next/server'
import { getAuthProfile } from '@/lib/supabase/get-profile'
import { encrypt } from '@/lib/crypto/encryption'

// GET — read AI config from organization settings
export async function GET() {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { profile, admin } = auth

  const { data: org } = await admin.from('organizations').select('settings').eq('id', profile.organization_id).single()

  const ai = (org?.settings as Record<string, unknown> | null)?.ai ?? {}
  return NextResponse.json(ai)
}

// PUT — save AI config to organization settings
export async function PUT(req: NextRequest) {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.profile.role !== 'owner' && auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admins pueden configurar la IA' }, { status: 403 })
  }
  const { profile, admin } = auth

  const body = await req.json()
  const { provider, apiKey, model } = body

  if (!provider) {
    return NextResponse.json({ error: 'Falta provider' }, { status: 400 })
  }

  // Get current settings
  const { data: org } = await admin.from('organizations').select('settings').eq('id', profile.organization_id).single()
  const currentSettings = (org?.settings as Record<string, unknown>) ?? {}
  const currentAi = (currentSettings.ai as Record<string, unknown> | undefined) ?? {}

  // If apiKey not provided, keep the existing (already encrypted) one
  const existingApiKey = currentAi.apiKey as string | undefined
  let finalApiKey = apiKey || existingApiKey
  if (!finalApiKey) {
    return NextResponse.json({ error: 'Falta apiKey (no hay una guardada)' }, { status: 400 })
  }

  // Encrypt new apiKey values that aren't already encrypted
  if (apiKey && !apiKey.startsWith('enc:')) {
    finalApiKey = encrypt(apiKey)
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
