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

function isAdmin(role: string) {
  return ['superadmin', 'owner', 'admin'].includes(role)
}

// GET — list specialties (default + org custom)
export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  // Fetch default specialties + org custom
  const { data, error } = await admin
    .from('specialties')
    .select('*')
    .or(`is_default.eq.true,organization_id.eq.${profile.organization_id}`)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — create custom specialty for the org
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, artifact_type } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('specialties')
    .insert({
      organization_id: profile.organization_id,
      name: name.trim(),
      artifact_type: artifact_type ?? null,
      is_default: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — update name or artifact_type of a custom specialty
export async function PATCH(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, name, artifact_type } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (artifact_type !== undefined) updates.artifact_type = artifact_type

  const { data, error } = await admin
    .from('specialties')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .eq('is_default', false)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove custom specialty (default ones are protected)
export async function DELETE(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  // Only allow deleting custom (non-default) specialties belonging to the org
  const { error } = await admin
    .from('specialties')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .eq('is_default', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
