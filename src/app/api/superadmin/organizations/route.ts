import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '../_helpers'

// GET — list all organizations with stats
export async function GET() {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('organizations')
    .select(`
      *,
      profiles(id, full_name, role),
      clinics(id, name, whatsapp_number, is_active)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create new organization + clinic + owner user
export async function POST(request: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { orgName, clinicName, ownerName, email, password, plan = 'starter' } = body

  if (!orgName || !email || !password || !ownerName) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  // 1. Create auth user
  const { data: { user: newUser }, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (userError || !newUser) {
    return NextResponse.json({ error: userError?.message ?? 'No se pudo crear el usuario' }, { status: 400 })
  }

  // 2. Create organization
  const slug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36)
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: orgName, slug, plan, is_active: true, settings: {} })
    .select()
    .single()

  if (orgError || !org) {
    await admin.auth.admin.deleteUser(newUser.id)
    return NextResponse.json({ error: orgError?.message ?? 'No se pudo crear la organización' }, { status: 500 })
  }

  // 3. Create clinic
  const { error: clinicError } = await admin
    .from('clinics')
    .insert({
      organization_id: org.id,
      name: clinicName || orgName,
      timezone: 'America/Argentina/Buenos_Aires',
      is_active: true,
      settings: {},
    })

  if (clinicError) {
    await admin.auth.admin.deleteUser(newUser.id)
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: clinicError.message }, { status: 500 })
  }

  // 4. Create profile
  const { error: profileError } = await admin
    .from('profiles')
    .insert({
      id: newUser.id,
      organization_id: org.id,
      full_name: ownerName,
      role: 'owner',
      is_active: true,
    })

  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.id)
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, orgId: org.id })
}

// PATCH — update organization or clinic
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, is_active, plan, name, clinicId, clinicName } = body

  // If clinicId is provided, update a clinic
  if (clinicId) {
    const updates: Record<string, unknown> = {}
    if (clinicName !== undefined) updates.name = clinicName
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 })

    const { error } = await admin.from('clinics').update(updates).eq('id', clinicId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (plan     !== undefined) updates.plan = plan
  if (name     !== undefined) updates.name = name

  const { error } = await admin
    .from('organizations')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — permanently delete an organization or clinic
export async function DELETE(request: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, clinicId } = await request.json()

  // If clinicId is provided, delete just that clinic
  if (clinicId) {
    const { error } = await admin.from('clinics').delete().eq('id', clinicId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Get auth users linked to profiles in this org so we can delete them
  const { data: profiles } = await admin.from('profiles').select('id').eq('organization_id', id)
  const authIds = (profiles ?? []).map(p => p.id)

  // Delete org (FKs cascade: clinics, weekly_schedules, appointments, etc.)
  const { error } = await admin.from('organizations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clean up auth users
  for (const uid of authIds) {
    try { await admin.auth.admin.deleteUser(uid) } catch { /* user may already be gone */ }
  }

  return NextResponse.json({ ok: true })
}

// POST (clinic) — add a new clinic to an existing organization
export async function PUT(request: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { organization_id, name } = body
  if (!organization_id || !name?.trim()) {
    return NextResponse.json({ error: 'organization_id y name son requeridos' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('clinics')
    .insert({
      organization_id,
      name: name.trim(),
      timezone: 'America/Argentina/Buenos_Aires',
      is_active: true,
      settings: {},
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE clinic
export async function OPTIONS(request: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clinicId } = await request.json()
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })

  const { error } = await admin.from('clinics').delete().eq('id', clinicId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
