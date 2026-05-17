import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { canAddProfessional } from '@/lib/plans/limits'
import type { OrgPlan } from '@/lib/types'

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

// GET — list professionals
export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  let query = admin
    .from('professionals')
    .select('*, specialty:specialties(*)')
    .eq('is_active', true)
    .order('full_name')
  if (profile.organization_id) query = query.eq('organization_id', profile.organization_id)
  else if (profile.role !== 'superadmin') query = query.is('organization_id', null)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — create professional
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { full_name, specialty_id, phone, email, color } = await req.json()
  if (!full_name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const admin = createAdminClient()

  // Plan limit check
  const { data: org } = await admin.from('organizations').select('plan').eq('id', profile.organization_id).single()
  const { count } = await admin.from('professionals').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('is_active', true)
  if (!canAddProfessional((org?.plan ?? 'starter') as OrgPlan, count ?? 0)) {
    return NextResponse.json({ error: 'plan_limit', message: 'Límite de profesionales alcanzado para tu plan' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('professionals')
    .insert({
      organization_id: profile.organization_id,
      full_name: full_name.trim(),
      specialty_id: specialty_id || null,
      phone: phone || null,
      email: email || null,
      color: color ?? '#6366f1',
      is_active: true,
    })
    .select('*, specialty:specialties(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — update professional
export async function PATCH(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, full_name, specialty_id, phone, email, bio, license_number } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('professionals')
    .update({
      full_name,
      specialty_id: specialty_id || null,
      phone: phone || null,
      email: email || null,
      bio: bio || null,
      license_number: license_number || null,
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('*, specialty:specialties(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT — link a professional to an auth user (create account for staff)
export async function PUT(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'owner' && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admins pueden crear usuarios' }, { status: 403 })
  }

  const { professional_id, email: userEmail, password, full_name: userName } = await req.json()
  if (!professional_id || !userEmail || !password) {
    return NextResponse.json({ error: 'Faltan campos: professional_id, email, password' }, { status: 400 })
  }
  if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })

  const admin = createAdminClient()

  // Verify professional belongs to same org
  const { data: prof } = await admin.from('professionals').select('id, organization_id, profile_id, full_name').eq('id', professional_id).single()
  if (!prof || prof.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (prof.profile_id) {
    return NextResponse.json({ error: 'Este profesional ya tiene un usuario vinculado' }, { status: 409 })
  }

  // Create auth user via Supabase Admin API
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
    user_metadata: {
      organization_id: profile.organization_id,
      full_name: userName || prof.full_name,
      role: 'staff',
    },
  })

  if (authError || !authUser?.user) {
    return NextResponse.json({ error: authError?.message ?? 'Error al crear usuario' }, { status: 500 })
  }

  // Update the profile row to set the correct role and org
  await admin.from('profiles').upsert({
    id: authUser.user.id,
    organization_id: profile.organization_id,
    full_name: userName || prof.full_name,
    role: 'staff',
    is_active: true,
  })

  // Link the professional to this profile
  const { error: linkError } = await admin.from('professionals')
    .update({ profile_id: authUser.user.id })
    .eq('id', professional_id)

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })

  return NextResponse.json({ ok: true, user_id: authUser.user.id, email: userEmail })
}

// DELETE (soft) — deactivate professional
export async function DELETE(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('professionals')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
