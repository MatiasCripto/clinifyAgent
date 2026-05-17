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
  // 1. Remove AI key from OdontoCare org
  const { error: e1 } = await sb.from('organizations')
    .update({ settings: {} })
    .eq('id', '00000000-0000-0000-0000-000000000001')
  console.log('Cleared OdontoCare settings:', e1?.message || 'OK')

  // 2. Deactivate seed professionals by org
  const { error: e2 } = await sb.from('professionals')
    .update({ is_active: false })
    .eq('organization_id', '00000000-0000-0000-0000-000000000001')
  console.log('Deactivated OdontoCare professionals:', e2?.message || 'OK')

  // 3. Verify
  const { data: profs } = await sb.from('professionals')
    .select('id, full_name, is_active, organization_id')
    .eq('is_active', true)
    .order('full_name')
  console.log('\nActive professionals:', JSON.stringify(profs, null, 2))
}

main().catch(e => console.error('ERR:', e.message))
