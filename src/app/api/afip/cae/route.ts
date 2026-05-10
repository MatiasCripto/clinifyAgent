import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAfipTicket, p12ToPem } from '@/lib/afip/wsaa'
import { requestCae } from '@/lib/afip/wsfe'

async function getClinicId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile) return null
  const { data: clinic } = await supabase.from('clinics').select('id').eq('organization_id', profile.organization_id).eq('is_active', true).limit(1).single()
  return clinic?.id ?? null
}

export async function POST(req: NextRequest) {
  const supabase  = await createClient()
  const clinicId  = await getClinicId(supabase)
  if (!clinicId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { invoiceId } = body
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId requerido' }, { status: 400 })

  // Cargar factura
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('clinic_id', clinicId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  if (invoice.afip_cae) return NextResponse.json({ error: 'Esta factura ya tiene CAE' }, { status: 400 })

  // Cargar credenciales AFIP de la clínica
  const { data: creds } = await supabase
    .from('afip_credentials')
    .select('*')
    .eq('clinic_id', clinicId)
    .single()

  if (!creds) return NextResponse.json({ error: 'Configurá las credenciales AFIP en Configuración → Clínica' }, { status: 400 })

  try {
    // Convertir .p12 a PEM
    const { certPem, keyPem } = p12ToPem(creds.certificate_base64, creds.passphrase)

    // Obtener ticket de autenticación WSAA
    const ticket = await getAfipTicket(creds.cuit, certPem, keyPem, 'wsfe', creds.sandbox)

    // Formatear fecha YYYYMMDD
    const invoiceDate = invoice.invoice_date.replace(/-/g, '')

    // Pedir CAE al WSFE
    const result = await requestCae(ticket, {
      cuit:        creds.cuit,
      puntoVenta:  creds.punto_venta ?? 1,
      invoiceType: invoice.invoice_type,
      subtotal:    invoice.subtotal,
      taxRate:     invoice.tax_rate,
      taxAmount:   invoice.tax_amount,
      total:       invoice.total,
      invoiceDate,
      currency:    invoice.currency,
      concept:     2, // servicios médicos/profesionales
    }, creds.sandbox)

    // Formatear fecha de vencimiento del CAE (YYYYMMDD → YYYY-MM-DD)
    const caeExpiry = result.caeExpiry
      ? `${result.caeExpiry.slice(0,4)}-${result.caeExpiry.slice(4,6)}-${result.caeExpiry.slice(6,8)}`
      : null

    // Guardar CAE en la factura
    const { data: updated } = await supabase
      .from('invoices')
      .update({
        afip_cae:        result.cae,
        afip_cae_expiry: caeExpiry,
        status:          'sent',
        updated_at:      new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single()

    return NextResponse.json({
      cae:          result.cae,
      cae_expiry:   caeExpiry,
      invoice_number: result.invoiceNumber,
      invoice:      updated,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
