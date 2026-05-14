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

// GET — list availability templates for a professional
export async function GET(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const professionalId = request.nextUrl.searchParams.get('professional_id')
  if (!professionalId) return NextResponse.json({ error: 'professional_id requerido' }, { status: 400 })

  const admin = createAdminClient()

  // Verify professional belongs to same org
  const { data: prof } = await admin.from('professionals').select('organization_id').eq('id', professionalId).single()
  if (!prof || prof.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('availability_templates')
    .select('*')
    .eq('professional_id', professionalId)
    .order('day_of_week')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — upsert availability template
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { professional_id, clinic_id, day_of_week, start_time, end_time, slot_duration } = body

  if (professional_id === undefined || day_of_week === undefined || !start_time || !end_time) {
    return NextResponse.json({ error: 'Faltan campos obligatorios: professional_id, day_of_week, start_time, end_time' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify professional belongs to same org
  const { data: prof } = await admin.from('professionals').select('organization_id').eq('id', professional_id).single()
  if (!prof || prof.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // If body has id, update existing; otherwise upsert
  if (body.id) {
    const { error } = await admin
      .from('availability_templates')
      .update({ day_of_week, start_time, end_time, slot_duration: slot_duration ?? 30 })
      .eq('id', body.id)
      .eq('professional_id', professional_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await admin
      .from('availability_templates')
      .upsert({
        professional_id,
        clinic_id: clinic_id || null,
        day_of_week,
        start_time,
        end_time,
        slot_duration: slot_duration ?? 30,
      }, { onConflict: 'professional_id,clinic_id,day_of_week,start_time' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return updated list
  const { data } = await admin
    .from('availability_templates')
    .select('*')
    .eq('professional_id', professional_id)
    .order('day_of_week')

  return NextResponse.json(data ?? [])
}

// DELETE — remove availability template
export async function DELETE(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('availability_templates').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
