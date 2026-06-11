import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { getAuthenticatedUser } from '@/lib/supabase/get-profile'

function parseDevice(ua: string): string {
  const browser =
    ua.includes('Edg/')     ? 'Edge'    :
    ua.includes('Chrome/')  ? 'Chrome'  :
    ua.includes('Firefox/') ? 'Firefox' :
    ua.includes('Safari/')  ? 'Safari'  : 'Unknown'

  const os =
    ua.includes('Windows NT')              ? 'Windows' :
    ua.includes('Mac OS X')                ? 'Mac'     :
    ua.includes('Android')                 ? 'Android' :
    ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' :
    ua.includes('Linux')                   ? 'Linux'   : 'Unknown'

  return `${browser} / ${os}`
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  // Resolve real IP (Vercel sets x-forwarded-for, fallback to x-real-ip)
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? '—')

  const ua     = req.headers.get('user-agent') ?? ''
  const device = parseDevice(ua)

  // Write to app_metadata (server-only field, not writable by the client)
  const admin = createAdminClient()
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { last_ip: ip, last_device: device, last_login_at: new Date().toISOString() },
  })

  return NextResponse.json({ ok: true })
}
