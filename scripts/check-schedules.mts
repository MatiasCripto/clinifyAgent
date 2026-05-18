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
  const { data: profs } = await sb.from('professionals').select('id, full_name').eq('organization_id','cdf2bf4e-a8de-470a-8247-ab515b6f5f0b')
  for (const p of profs ?? []) {
    console.log(`\n=== ${p.full_name} (${p.id.slice(0,8)}) ===`)
    const { data: scheds } = await sb.from('weekly_schedules').select('*').eq('professional_id', p.id).order('week_start_date', { ascending: false })
    for (const s of scheds ?? []) {
      const days = Object.entries(s.schedule as Record<string,any>).filter(([,d]) => d.is_working).map(([k]) => ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][parseInt(k)])
      console.log(`  week ${s.week_start_date} (${s.id.slice(0,8)}): working=${days.join(',')}`)
    }
  }
}
main()
