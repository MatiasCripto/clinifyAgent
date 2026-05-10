import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '../_helpers'

export async function GET(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const workflow = searchParams.get('workflow')
  const orgId    = searchParams.get('orgId')
  const limit    = parseInt(searchParams.get('limit') ?? '100')
  const offset   = parseInt(searchParams.get('offset') ?? '0')

  let query = admin
    .from('automation_logs')
    .select(`
      *,
      clinics(id, name, organization_id, organizations(id, name))
    `, { count: 'exact' })
    .order('executed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status)   query = query.eq('status', status)
  if (workflow) query = query.ilike('workflow', `%${workflow}%`)
  if (orgId) {
    const { data: clinicIds } = await admin
      .from('clinics')
      .select('id')
      .eq('organization_id', orgId)
    const ids = (clinicIds ?? []).map(c => c.id)
    if (ids.length > 0) query = query.in('clinic_id', ids)
    else return NextResponse.json({ data: [], count: 0 })
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}
