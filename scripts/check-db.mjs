import { createServiceClient } from '../src/lib/supabase/service.js'

const sb = createServiceClient()

async function main() {
  // Check org cdf2bf4e (Clinica Ursula)
  const { data: org } = await sb.from('organizations').select('id, name, settings').eq('id', 'cdf2bf4e-b908-45af-b142-6a8b505e43d9').single()
  console.log('ORG:', JSON.stringify(org, null, 2))

  // Active professionals in this org
  const { data: profs } = await sb.from('professionals').select('id, full_name, specialty_id, is_active, organization_id').eq('organization_id', 'cdf2bf4e-b908-45af-b142-6a8b505e43d9').eq('is_active', true)
  console.log('\nPROFESSIONALS:', JSON.stringify(profs, null, 2))

  // All specialties
  const { data: specs } = await sb.from('specialties').select('id, name')
  console.log('\nSPECIALTIES:', JSON.stringify(specs, null, 2))

  // Schedules for each professional
  for (const p of profs || []) {
    const { data: ws } = await sb.from('weekly_schedules').select('*').eq('professional_id', p.id)
    console.log('\nWEEKLY SCHEDULE for', p.full_name, ':', JSON.stringify(ws, null, 2))

    const { data: at } = await sb.from('availability_templates').select('*').eq('professional_id', p.id).eq('is_active', true)
    console.log('AVAILABILITY TEMPLATES for', p.full_name, ':', JSON.stringify(at, null, 2))

    const { data: sa } = await sb.from('service_areas').select('*').eq('professional_id', p.id)
    console.log('SERVICE AREAS for', p.full_name, ':', JSON.stringify(sa, null, 2))
  }

  // Clinics in this org
  const { data: clinics } = await sb.from('clinics').select('*').eq('organization_id', 'cdf2bf4e-b908-45af-b142-6a8b505e43d9')
  console.log('\nCLINICS:', JSON.stringify(clinics, null, 2))

  // Appointments for this org
  const { data: appts } = await sb.from('appointments').select('*').limit(10).order('created_at', { ascending: false })
  console.log('\nRECENT APPOINTMENTS:', JSON.stringify(appts, null, 2))
}

main().catch(console.error)
