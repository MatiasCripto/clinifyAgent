import { NextRequest, NextResponse } from 'next/server'
import { getAuthProfile } from '@/lib/supabase/get-profile'

export async function POST(req: NextRequest) {
  const auth = await getAuthProfile()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { profile, admin } = auth

  const body = await req.json()
  const { title, description } = body

  if (!title || !description) {
    return NextResponse.json({ error: 'Título y descripción son requeridos' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('support_tickets')
    .insert({
      organization_id: profile.organization_id,
      title,
      description,
      priority: 'medium',
      status: 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
