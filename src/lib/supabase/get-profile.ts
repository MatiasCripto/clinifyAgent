import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server-admin'

export interface AuthProfile {
  organization_id: string
  role: string
}

export interface AuthSession {
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>
  profile: AuthProfile
  admin: ReturnType<typeof createAdminClient>
}

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

export async function getAuthProfile(): Promise<AuthSession | null> {
  const user = await getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  return { user, profile, admin }
}

export async function getAuthenticatedUser() {
  return getUser()
}
