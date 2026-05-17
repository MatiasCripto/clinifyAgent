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

// GET — list service areas for a professional
export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const professionalId = req.nextUrl.searchParams.get('professional_id')
  if (!professionalId) return NextResponse.json({ error: 'professional_id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_areas')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — create or update a service area
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, professional_id, name, duration_min } = body

  if (!professional_id || !name?.trim()) {
    return NextResponse.json({ error: 'Faltan campos: professional_id, name' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (id) {
    // Update existing
    const { data, error } = await admin
      .from('service_areas')
      .update({ name: name.trim(), duration_min: duration_min || 30 })
      .eq('id', id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Check if an inactive area with the same name exists → reactivate it
  const { data: existing } = await admin
    .from('service_areas')
    .select('id')
    .eq('professional_id', professional_id)
    .eq('name', name.trim())
    .eq('is_active', false)
    .maybeSingle()

  if (existing) {
    const { data: reactivated, error } = await admin
      .from('service_areas')
      .update({ name: name.trim(), duration_min: duration_min || 30, is_active: true })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(reactivated)
  }

  // Create new
  const { data, error } = await admin
    .from('service_areas')
    .insert({
      professional_id,
      name: name.trim(),
      duration_min: duration_min || 30,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — soft-delete a service area
export async function DELETE(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('service_areas')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
