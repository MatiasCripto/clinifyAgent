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
  // Find or create superadmin auth user
  const { data: users } = await sb.auth.admin.listUsers()
  const saUser = users?.users?.filter(u => u.email === 'scaronejonatan@gmail.com')[0]

  let uid: string
  if (!saUser) {
    const { data: newUser, error } = await sb.auth.admin.createUser({
      email: 'scaronejonatan@gmail.com',
      password: 'Admin123!',
      email_confirm: true,
    })
    if (error) { console.error('Create error:', error.message); return }
    uid = newUser.user!.id
    console.log('Created auth user:', uid)
  } else {
    uid = saUser.id
    console.log('Auth user exists:', uid)
    await sb.auth.admin.updateUserById(uid, { password: 'Admin123!' })
    console.log('Password reset to Admin123!')
  }

  // Upsert profile with NULL organization_id
  const { error: pe } = await sb.from('profiles').upsert({
    id: uid,
    organization_id: null,
    full_name: 'Jonatan Scarone',
    role: 'superadmin',
    is_active: true,
  }, { onConflict: 'id' })
  console.log('Profile upsert:', pe?.message || 'OK')

  // Verify
  const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).single()
  console.log('Profile:', JSON.stringify(profile))

  // Delete Platform org if exists
  const { data: plat } = await sb.from('organizations').select('id').eq('slug', 'platform').maybeSingle()
  if (plat) {
    const { error: de } = await sb.from('organizations').delete().eq('id', plat.id)
    console.log('Deleted Platform org:', de?.message || 'OK')
  }
}

main().catch(e => console.error('ERR:', e.message))
