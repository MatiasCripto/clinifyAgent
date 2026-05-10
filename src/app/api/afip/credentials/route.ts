import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getClinicId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile) return null
  const { data: clinic } = await supabase.from('clinics').select('id').eq('organization_id', profile.organization_id).eq('is_active', true).limit(1).single()
  return clinic?.id ?? null
}

export async function GET() {
  const supabase = await createClient()
  const clinicId = await getClinicId(supabase)
  if (!clinicId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('afip_credentials')
    .select('id, cuit, punto_venta, sandbox, has_certificate, created_at')
    .eq('clinic_id', clinicId)
    .single()

  return NextResponse.json(data ?? null)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const clinicId = await getClinicId(supabase)
  if (!clinicId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { cuit, punto_venta, sandbox, certificate_base64, passphrase } = body

  if (!cuit) return NextResponse.json({ error: 'CUIT requerido' }, { status: 400 })

  const record: Record<string, unknown> = {
    clinic_id:   clinicId,
    cuit:        cuit.replace(/-/g, ''),
    punto_venta: punto_venta ?? 1,
    sandbox:     sandbox ?? true,
    updated_at:  new Date().toISOString(),
  }

  if (certificate_base64) {
    record.certificate_base64 = certificate_base64
    record.has_certificate    = true
  }
  if (passphrase !== undefined) {
    record.passphrase = passphrase
  }

  const { data, error } = await supabase
    .from('afip_credentials')
    .upsert(record, { onConflict: 'clinic_id' })
    .select('id, cuit, punto_venta, sandbox, has_certificate')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
