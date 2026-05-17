import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const env: Record<string, string> = {}
for (const l of fs.readFileSync('.env.local','utf-8').split('\n')) {
  const i = l.indexOf('=')
  if (i===-1||l.trim().startsWith('#')) continue
  env[l.slice(0,i).trim()] = l.slice(i+1).trim().replace(/^['\"]|['\"]$/g,'')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!)

async function main() {
  const { data: users } = await sb.auth.admin.listUsers()
  const u = (users?.users ?? []).find((x: any) => x.email === 'pepepompin@gmail.com')
  console.log('Auth user:', u ? { id: u.id, email: u.email } : 'NOT FOUND')

  if (u) {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', u.id).single()
    console.log('Profile:', JSON.stringify(profile))
  }

  const { data: all } = await sb.from('profiles').select('id, full_name, role, organization_id').limit(20)
  console.log('\nAll profiles:', JSON.stringify(all))
}
main()
