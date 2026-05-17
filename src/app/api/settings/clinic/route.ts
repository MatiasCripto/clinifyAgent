import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server-admin'

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET — list clinics for the user's organization
export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Superadmin sees all clinics, others see only their org
  const query = admin.from('clinics').select('id, name, organization_id').eq('is_active', true)
  if (profile.role !== 'superadmin') query.eq('organization_id', profile.organization_id)

  const { data, error } = await query.order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PUT — update clinic fields
export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify user has owner/admin role in their org
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['superadmin', 'owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { clinicId, name, address, phone, whatsapp_number, timezone } = body

  if (!clinicId || !name) {
    return NextResponse.json({ error: 'clinicId y name son requeridos' }, { status: 400 })
  }

  // Verify the clinic belongs to this org
  const { data: clinic } = await admin
    .from('clinics')
    .select('id, organization_id')
    .eq('id', clinicId)
    .single()

  if (!clinic || (profile.role !== 'superadmin' && clinic.organization_id !== profile.organization_id)) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('clinics')
    .update({ name, address: address ?? null, phone: phone ?? null, whatsapp_number: whatsapp_number ?? null, timezone })
    .eq('id', clinicId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
