import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '../_helpers'
import type { UserRole } from '@/lib/types'

// GET ?orgId=xxx  — list users for one org (or all orgs)
export async function GET(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = req.nextUrl.searchParams.get('orgId')

  const query = admin
    .from('profiles')
    .select('*, organizations(id, name)')
    .order('created_at', { ascending: false })

  const { data: profiles, error } = orgId
    ? await query.eq('organization_id', orgId)
    : await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with auth metadata (email, last_sign_in_at, email_confirmed_at)
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authMap = new Map(authUsers.map(u => [u.id, u]))

  const enriched = (profiles ?? []).map(p => ({
    ...p,
    email:              authMap.get(p.id)?.email              ?? null,
    last_sign_in_at:    authMap.get(p.id)?.last_sign_in_at    ?? null,
    email_confirmed_at: authMap.get(p.id)?.email_confirmed_at ?? null,
  }))

  return NextResponse.json(enriched)
}

// POST — create a new user inside an existing organization
export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { orgId, fullName, email, password, role = 'staff' } = await req.json()

  if (!orgId || !fullName || !email || !password) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const { data: { user: newUser }, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !newUser) {
    return NextResponse.json({ error: authError?.message ?? 'Error al crear usuario' }, { status: 400 })
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id:              newUser.id,
    organization_id: orgId,
    full_name:       fullName,
    role:            role as UserRole,
    is_active:       true,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: newUser.id })
}

// PATCH — update profile fields and/or reset password
export async function PATCH(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, fullName, role, is_active, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  if (password) {
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (fullName   !== undefined) updates.full_name  = fullName
  if (role       !== undefined) updates.role        = role
  if (is_active  !== undefined) updates.is_active   = is_active

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from('profiles').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — hard-delete user (profile cascade + auth user)
export async function DELETE(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  await admin.from('profiles').delete().eq('id', id)

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
