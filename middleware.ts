import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/editor', req.url))
  }
})

export const config = {
  // API 라우트는 각 route handler에서 개별적으로 auth() 검사
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
