import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  let val = trimmed.slice(eqIdx + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
  env[key] = val
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!)

async function main() {
  // Check all tables for Clinica Ursula
  const orgId = 'cdf2bf4e-a8de-470a-8247-ab515b6f5f0b'

  console.log('=== ORGANIZATIONS ===')
  const { data: orgs } = await sb.from('organizations').select('id, name, settings').eq('id', orgId)
  for (const o of (orgs ?? [])) {
    const hasAi = !!(o.settings as any)?.ai?.apiKey
    console.log(`  ${o.id.slice(0,8)} "${o.name}" AI:${hasAi}`)
  }

  console.log('\n=== PROFESSIONALS (Clinica Ursula) ===')
  const { data: profs } = await sb.from('professionals').select('id, full_name, specialty_id, is_active').eq('organization_id', orgId)
  for (const p of (profs ?? [])) console.log(`  ${p.id.slice(0,8)} | ${p.full_name} | active:${p.is_active} | specialty:${(p.specialty_id as string).slice(0,8)}`)

  console.log('\n=== WEEKLY SCHEDULES (Clinica Ursula professionals) ===')
  for (const p of (profs ?? [])) {
    const { data: ws } = await sb.from('weekly_schedules').select('id, week_start_date').eq('professional_id', p.id)
    console.log(`  ${p.full_name}: ${(ws ?? []).length} schedule(s)`)
    for (const w of (ws ?? [])) {
      console.log(`    week_start: ${w.week_start_date}, id: ${(w.id as string).slice(0,8)}`)
    }
  }

  console.log('\n=== SERVICE AREAS (Clinica Ursula professionals) ===')
  for (const p of (profs ?? [])) {
    const { data: sa } = await sb.from('service_areas').select('id, name, duration_min, is_active').eq('professional_id', p.id)
    console.log(`  ${p.full_name}: ${(sa ?? []).length} area(s)`)
    for (const a of (sa ?? [])) console.log(`    ${a.name} (${a.duration_min}min) active:${a.is_active}`)
  }

  console.log('\n=== APPOINTMENTS (all) ===')
  const { data: appts } = await sb.from('appointments').select('id, starts_at, treatment, status, professional_id, clinic_id').limit(10).order('created_at', { ascending: false })
  for (const a of (appts ?? [])) {
    const { data: clinic } = await sb.from('clinics').select('name, organization_id').eq('id', a.clinic_id).single()
    console.log(`  ${a.starts_at} | ${a.treatment} | ${a.status} | clinic: ${clinic?.name ?? '?'} (org: ${(clinic?.organization_id as string)?.slice(0,8) ?? '?'})`)
  }

  console.log('\n=== PATIENTS ===')
  const { data: patients } = await sb.from('patients').select('id, first_name, last_name, phone, organization_id').limit(20)
  for (const p of (patients ?? [])) console.log(`  ${p.first_name} ${p.last_name} | phone: ${p.phone} | org: ${(p.organization_id as string).slice(0,8)}`)

  console.log('\n=== WA CONVERSATIONS ===')
  const { data: convs } = await sb.from('wa_conversations').select('phone, bot_state').limit(10)
  for (const c of (convs ?? [])) console.log(`  phone: ${c.phone} | state: ${c.bot_state}`)
}

main().catch(e => console.error('ERR:', e.message))
