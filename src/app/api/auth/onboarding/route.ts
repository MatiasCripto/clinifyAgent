import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedUser } from '@/lib/supabase/get-profile'
import { createAdminClient } from '@/lib/supabase/server-admin'

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clinicName, specialty, phone } = await req.json()
  if (!clinicName?.trim()) {
    return NextResponse.json({ error: 'El nombre de la clínica es requerido' }, { status: 400 })
  }

  // Generate a unique slug from the clinic name
  const slug = `${clinicName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${user.id.slice(0, 8)}`

  const admin = createAdminClient()

  try {
    // 1. Create the organization
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: clinicName.trim(),
        slug,
        is_active: true,
      })
      .select()
      .single()

    if (orgError) throw new Error(orgError.message)

    // 2. Create the clinic under this organization
    const { error: clinicError } = await admin
      .from('clinics')
      .insert({
        organization_id: org.id,
        name: `${clinicName.trim()} (Principal)`,
        phone: phone || null,
        is_active: true,
      })

    if (clinicError) throw new Error(clinicError.message)

    // 3. Update the user's profile to link to the organization
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        organization_id: org.id,
        role: 'owner',
      })
      .eq('id', user.id)

    if (profileError) throw new Error(profileError.message)

    return NextResponse.json({ ok: true, organizationId: org.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear la organización'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
