import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
const env: Record<string, string> = {}
for (const l of fs.readFileSync('.env.local','utf-8').split('\n')) {
  const i = l.indexOf('=')
  if (i===-1||l.trim().startsWith('#')) continue
  env[l.slice(0,i).trim()] = l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!)
async function main() {
  const orgId = 'cdf2bf4e-a8de-470a-8247-ab515b6f5f0b'
  const { data: profs } = await sb.from('professionals').select('id,full_name').eq('organization_id',orgId)
  for (const p of (profs??[])) {
    const { error, count } = await sb.from('weekly_schedules').delete({ count: 'exact' }).eq('professional_id', p.id)
    console.log(p.full_name,':', error?.message ?? `deleted ${count}`)
  }
}
main()
