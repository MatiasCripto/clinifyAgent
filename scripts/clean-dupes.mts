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
  const { data: all } = await sb.from('weekly_schedules').select('*').order('created_at', { ascending: true })
  console.log(`Total schedules: ${all?.length ?? 0}`)

  // Group by professional_id + week_start_date + COALESCE(clinic_id, 'null')
  const groups = new Map<string, any[]>()
  for (const s of (all ?? [])) {
    const key = `${s.professional_id}|${s.week_start_date}|${s.clinic_id ?? 'NULL'}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  let deleted = 0
  for (const [, rows] of groups) {
    if (rows.length > 1) {
      // Keep the most recent, delete the rest
      const toDelete = rows.slice(0, rows.length - 1)
      for (const d of toDelete) {
        const { error } = await sb.from('weekly_schedules').delete().eq('id', d.id)
        if (error) console.error('Delete error:', error.message)
        else { deleted++; console.log(`Deleted dupe: ${d.id.slice(0,8)} (${d.professional_id.slice(0,8)} | ${d.week_start_date})`) }
      }
    }
  }
  console.log(`\nDeleted ${deleted} duplicates`)
}

main()
