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

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const clinicId = await getClinicId(supabase)
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const status    = searchParams.get('status')

  let query = supabase
    .from('invoices')
    .select(`*, items:invoice_items(*), patients(id, first_name, last_name)`)
    .eq('clinic_id', clinicId)
    .order('invoice_date', { ascending: false })

  if (patientId) query = query.eq('patient_id', patientId)
  if (status)    query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const clinicId = await getClinicId(supabase)
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { patient_id, invoice_date, due_date, items, notes, currency, tax_rate, invoice_type } = body

  if (!items || items.length === 0) return NextResponse.json({ error: 'Se requiere al menos un ítem' }, { status: 400 })

  const subtotal = items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
  const tax      = subtotal * ((tax_rate ?? 21) / 100)
  const total    = subtotal + tax

  // Auto invoice number: INV-YYYYMM-NNN
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
  const num = String((count ?? 0) + 1).padStart(4, '0')
  const invoice_number = `${invoice_type ?? 'FC-C'}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${num}`

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      clinic_id: clinicId,
      patient_id: patient_id || null,
      invoice_number,
      invoice_date: invoice_date ?? new Date().toISOString().slice(0, 10),
      due_date: due_date || null,
      status: 'draft',
      currency: currency ?? 'ARS',
      subtotal,
      tax_rate: tax_rate ?? 21,
      tax_amount: tax,
      total,
      notes: notes || null,
      invoice_type: invoice_type ?? 'FC-C',
    })
    .select()
    .single()

  if (error || !invoice) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })

  // Insert items
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('invoice_items').insert(
      items.map((i: { description: string; quantity: number; unit_price: number }) => ({
        invoice_id: invoice.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.quantity * i.unit_price,
      }))
    )
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const { data: full } = await supabase
    .from('invoices')
    .select(`*, items:invoice_items(*), patients(id, first_name, last_name)`)
    .eq('id', invoice.id)
    .single()

  return NextResponse.json(full)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const clinicId = await getClinicId(supabase)
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  if (updates.status === 'paid' && !updates.paid_at) {
    updates.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('invoices')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const clinicId = await getClinicId(supabase)
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('clinic_id', clinicId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
