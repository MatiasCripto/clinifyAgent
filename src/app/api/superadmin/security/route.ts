import { NextResponse } from 'next/server'
import { requireSuperadmin } from '../_helpers'

// GET — security overview: all auth users enriched with profile/org data
export async function GET() {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch all auth users (includes last_sign_in_at, created_at, email_confirmed_at)
  const { data: { users: authUsers }, error: authError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // Fetch all profiles with org name
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, role, is_active, organization_id, organizations(name)')
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const rows = authUsers
    .filter(u => profileMap.has(u.id)) // skip superadmin-only users without profile
    .map(u => {
      const p = profileMap.get(u.id)!
      return {
        id:                 u.id,
        email:              u.email ?? null,
        full_name:          p.full_name,
        role:               p.role,
        is_active:          p.is_active,
        org_name:           (p.organizations as unknown as { name: string } | null)?.name ?? '—',
        organization_id:    p.organization_id,
        last_sign_in_at:    u.last_sign_in_at    ?? null,
        created_at:         u.created_at,
        email_confirmed_at: u.email_confirmed_at ?? null,
        provider:           u.app_metadata?.provider  ?? 'email',
        last_ip:            u.app_metadata?.last_ip    ?? null,
        last_device:        u.app_metadata?.last_device ?? null,
        last_login_at:      u.app_metadata?.last_login_at ?? null,
      }
    })
    .sort((a, b) => {
      // Sort by last_sign_in_at desc (nulls last)
      if (!a.last_sign_in_at && !b.last_sign_in_at) return 0
      if (!a.last_sign_in_at) return 1
      if (!b.last_sign_in_at) return -1
      return new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime()
    })

  return NextResponse.json(rows)
}

// DELETE — force sign-out all sessions for a user
export async function DELETE(req: Request) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await admin.auth.admin.signOut(id, 'global')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
