import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server-admin'

const SUPERADMIN_EMAIL = 'scaronejonatan@gmail.com'

export async function requireSuperadmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (user.email !== SUPERADMIN_EMAIL) return null

  return createAdminClient()
}
