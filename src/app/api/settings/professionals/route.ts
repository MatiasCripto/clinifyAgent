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
  const { data, error } = await admin
    .from('professionals')
    .select('*, specialty:specialties(*)')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .order('full_name')
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
