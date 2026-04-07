import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000 // 15분
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(username: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(username)
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(username, { count: 1, resetAt: now + LOCK_MS })
    return true
  }
  if (entry.count >= MAX_ATTEMPTS) return false
  entry.count += 1
  return true
}

function resetRateLimit(username: string) {
  loginAttempts.delete(username)
}

async function resolveUserRole(userId?: string | null) {
  if (!userId) return undefined
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role as UserRole | undefined
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const username = credentials.username as string
        if (!checkRateLimit(username)) return null
        const user = await prisma.user.findUnique({ where: { username } })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        resetRateLimit(username)
        return { id: user.id, name: user.username, email: null, role: user.role }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // 로그인 직후에만 DB 조회 (authorize()에서 반환한 user 객체 기반)
        token.id = user.id
        const userId = user.id as string | undefined
        const resolvedRole = await resolveUserRole(userId)
        if (resolvedRole) token.role = resolvedRole
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const userId = (token.id as string | undefined) ?? token.sub
        if (userId) session.user.id = userId
        // token에 이미 저장된 role을 신뢰 (DB 재조회 불필요)
        const role = token.role as UserRole | undefined
        if (role) session.user.role = role
      }
      return session
    },
  },
})
