import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { PLAN_LIMITS } from '@/lib/plans/limits'

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

// POST — create a new clinic (checks plan limits)
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['superadmin', 'owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, address, phone, whatsapp_number, timezone } = body

  if (!name) {
    return NextResponse.json({ error: 'El nombre de la clínica es requerido' }, { status: 400 })
  }

  // Check plan limit: count existing active clinics for this org
  const { count: clinicCount, error: countError } = await admin
    .from('clinics')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

  // Fetch org plan to check limits
  const { data: org } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', profile.organization_id)
    .single()

  const plan = (org?.plan as string) ?? 'starter'
  const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.clinics ?? PLAN_LIMITS.starter.clinics

  if (limit !== null && clinicCount !== null && clinicCount >= limit) {
    return NextResponse.json({
      error: `Límite de sucursales alcanzado. Tu plan ${plan === 'starter' ? 'Starter' : plan === 'pro' ? 'Pro' : 'Enterprise'} permite hasta ${limit} sucursal${limit !== 1 ? 'es' : ''}.`,
    }, { status: 402 })
  }

  const { data: clinic, error } = await admin
    .from('clinics')
    .insert({
      organization_id: profile.organization_id,
      name,
      address: address ?? null,
      phone: phone ?? null,
      whatsapp_number: whatsapp_number ?? null,
      timezone: timezone ?? 'America/Argentina/Cordoba',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(clinic)
}
