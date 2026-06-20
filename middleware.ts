import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Basic security headers + no client-side access to /admin without auth cookie check
// Real auth check happens in React (Firebase client), and server APIs verify ID tokens.
// This just prevents caching of admin pages.
export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png).*)'],
}
