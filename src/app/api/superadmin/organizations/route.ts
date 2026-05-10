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

// PATCH — toggle organization is_active
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, is_active, plan, name } = body
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
