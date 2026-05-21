import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyJobAuth, jobUnauthorized } from '../_helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — list recent automation logs (for dashboard)
export async function GET(request: NextRequest) {
  if (!verifyJobAuth(request)) return jobUnauthorized()

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('automation_logs')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
