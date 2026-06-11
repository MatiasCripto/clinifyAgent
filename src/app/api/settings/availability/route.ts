import { NextRequest, NextResponse } from 'next/server'
import { getAuthProfile } from '@/lib/supabase/get-profile'

// GET — fetch weekly schedule for a professional
export async function GET(request: NextRequest) {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { profile, admin } = auth

  const professionalId = request.nextUrl.searchParams.get('professional_id')
  const weekStart = request.nextUrl.searchParams.get('week_start')
  if (!professionalId) return NextResponse.json({ error: 'professional_id requerido' }, { status: 400 })
  if (!weekStart) return NextResponse.json({ error: 'week_start requerido (YYYY-MM-DD, lunes)' }, { status: 400 })

  const { data: prof } = await admin.from('professionals').select('organization_id').eq('id', professionalId).single()
  if (!prof || prof.organization_id !== profile.organization_id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('weekly_schedules')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('week_start_date', weekStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

// POST — upsert weekly schedule
export async function POST(req: NextRequest) {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { profile, admin } = auth

  const body = await req.json()
  const { professional_id, clinic_id, week_start_date, schedule } = body

  if (!professional_id || !week_start_date || !schedule) {
    return NextResponse.json({ error: 'Faltan campos: professional_id, week_start_date, schedule' }, { status: 400 })
  }

  const { data: prof } = await admin.from('professionals').select('organization_id').eq('id', professional_id).single()
  if (!prof || prof.organization_id !== profile.organization_id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Manual upsert — PostgreSQL UNIQUE constraint doesn't match NULLs,
  // so we check existence first and UPDATE or INSERT accordingly.
  const matchQuery = admin
    .from('weekly_schedules')
    .select('id')
    .eq('professional_id', professional_id)
    .eq('week_start_date', week_start_date)

  if (clinic_id) matchQuery.eq('clinic_id', clinic_id)
  else matchQuery.is('clinic_id', null)

  const { data: existingRow } = await matchQuery.maybeSingle()

  if (existingRow) {
    const { data, error } = await admin
      .from('weekly_schedules')
      .update({ clinic_id: clinic_id || null, schedule })
      .eq('id', existingRow.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await admin
    .from('weekly_schedules')
    .insert({ professional_id, clinic_id: clinic_id || null, week_start_date, schedule })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove weekly schedule
export async function DELETE(req: NextRequest) {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { profile, admin } = auth

  const { professional_id, week_start_date } = await req.json()
  if (!professional_id || !week_start_date) {
    return NextResponse.json({ error: 'Faltan professional_id y week_start_date' }, { status: 400 })
  }

  const { data: prof } = await admin.from('professionals').select('organization_id').eq('id', professional_id).single()
  if (!prof || prof.organization_id !== profile.organization_id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin
    .from('weekly_schedules')
    .delete()
    .eq('professional_id', professional_id)
    .eq('week_start_date', week_start_date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
