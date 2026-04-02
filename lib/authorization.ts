import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden(message = '템플릿 관리 권한이 없습니다.') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function isAdminRole(role?: string | null): role is 'ADMIN' {
  return role === 'ADMIN'
}

export function requireSession(session: Session | null) {
  return session ? null : unauthorized()
}

export function requireAdmin(session: Session | null) {
  if (!session) return unauthorized()
  if (!isAdminRole(session.user?.role)) return forbidden()
  return null
}
