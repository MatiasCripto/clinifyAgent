import { createAdminClient } from '@/lib/supabase/server-admin'
import { getAuthProfile } from '@/lib/supabase/get-profile'

export async function requireSuperadmin() {
  const auth = await getAuthProfile()
  if (!auth || auth.profile.role !== 'superadmin') return null
  return auth.admin
}
