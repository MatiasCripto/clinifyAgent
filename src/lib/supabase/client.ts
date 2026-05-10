import { createBrowserClient } from '@supabase/ssr'

// Fallback to empty strings during build — the client is only used client-side
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}
