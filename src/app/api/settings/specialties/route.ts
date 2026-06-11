import { NextRequest, NextResponse } from 'next/server'
import { getAuthProfile } from '@/lib/supabase/get-profile'

function isAdmin(role: string) {
  return ['superadmin', 'owner', 'admin'].includes(role)
}

// GET — list specialties (default + org custom)
export async function GET() {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { profile, admin } = auth

  const { data, error } = await admin
    .from('specialties')
    .select('*')
    .or(`is_default.eq.true,organization_id.eq.${profile.organization_id}`)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const seen = new Map<string, Record<string, unknown>>()
  for (const s of (data ?? [])) {
    const name = s.name as string
    const existing = seen.get(name)
    if (!existing || (s.is_default && !existing.is_default)) {
      seen.set(name, s as unknown as Record<string, unknown>)
    }
  }

  return NextResponse.json(Array.from(seen.values()))
}

// POST — create custom specialty for the org
export async function POST(req: NextRequest) {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth.profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { profile, admin } = auth

  const { name, artifact_type } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

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
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth.profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { profile, admin } = auth

  const { id, name, artifact_type } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

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
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth.profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { profile, admin } = auth

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await admin
    .from('specialties')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .eq('is_default', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
