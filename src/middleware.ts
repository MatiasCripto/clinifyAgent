import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/register',
  '/api/webhooks',
  '/api/health',
  '/api/jobs',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes through without session check
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Superadmin login is public; other /superadmin/* routes are protected
  // The dashboard layout already redirects superadmins out of /(dashboard)
  if (pathname.startsWith('/superadmin')) {
    if (pathname === '/superadmin/login') {
      return NextResponse.next()
    }
    // All other /superadmin/* routes fall through to updateSession
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    // Match all routes except static files, _next internals, and assets
    '/((?!_next/static|_next/image|favicon.ico|images/|artifacts/|.*\\.).*)',
  ],
}
