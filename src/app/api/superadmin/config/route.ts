import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '../_helpers'

// GET /api/superadmin/config?section=flags|keys|settings
export async function GET(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const section = new URL(req.url).searchParams.get('section') ?? 'all'

  const result: Record<string, unknown> = {}

  if (section === 'all' || section === 'flags') {
    const { data } = await admin.from('feature_flags').select('*').order('key')
    result.flags = data ?? []
  }

  if (section === 'all' || section === 'keys') {
    const { data } = await admin.from('api_keys').select('id, service, label, masked_value, last_used_at, created_at').order('service')
    result.keys = data ?? []
  }

  if (section === 'all' || section === 'settings') {
    const { data } = await admin.from('platform_config').select('*').order('key')
    result.settings = data ?? []
  }

  return NextResponse.json(result)
}

// POST /api/superadmin/config
export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { type, ...payload } = body

  if (type === 'flag') {
    const { data, error } = await admin
      .from('feature_flags')
      .insert({ key: payload.key, name: payload.name, description: payload.description, enabled: payload.enabled ?? false })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'key') {
    const masked = maskValue(payload.value)
    const { data, error } = await admin
      .from('api_keys')
      .insert({ service: payload.service, label: payload.label, masked_value: masked, raw_value: payload.value })
      .select('id, service, label, masked_value, last_used_at, created_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'setting') {
    const { data, error } = await admin
      .from('platform_config')
      .upsert({ key: payload.key, value: payload.value, description: payload.description }, { onConflict: 'key' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'type inválido' }, { status: 400 })
}

// PATCH /api/superadmin/config
export async function PATCH(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { type, id, ...updates } = body

  if (type === 'flag') {
    const { data, error } = await admin.from('feature_flags').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'key') {
    if (updates.value) {
      updates.masked_value = maskValue(updates.value)
      updates.raw_value = updates.value
      delete updates.value
    }
    const { data, error } = await admin.from('api_keys').update(updates).eq('id', id).select('id, service, label, masked_value, last_used_at, created_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'type inválido' }, { status: 400 })
}

// DELETE /api/superadmin/config?type=flag|key&id=xxx
export async function DELETE(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const id   = searchParams.get('id')
  if (!type || !id) return NextResponse.json({ error: 'type e id requeridos' }, { status: 400 })

  const table = type === 'flag' ? 'feature_flags' : type === 'key' ? 'api_keys' : null
  if (!table) return NextResponse.json({ error: 'type inválido' }, { status: 400 })

  const { error } = await admin.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function maskValue(value: string): string {
  if (value.length <= 8) return '••••••••'
  return value.slice(0, 4) + '•'.repeat(Math.min(value.length - 8, 20)) + value.slice(-4)
}
