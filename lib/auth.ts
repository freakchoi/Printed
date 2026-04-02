import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

async function resolveUserRole(userId?: string | null) {
  if (!userId) return undefined
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role as UserRole | undefined
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        })
        if (!user) return null
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null
        return { id: user.id, name: user.username, email: null, role: user.role }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      const userId = (user?.id as string | undefined) ?? (token.id as string | undefined) ?? token.sub
      const resolvedRole = await resolveUserRole(userId)
      if (resolvedRole) token.role = resolvedRole
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const userId = (token.id as string | undefined) ?? token.sub
        if (userId) session.user.id = userId
        const resolvedRole = (token.role as UserRole | undefined) ?? await resolveUserRole(userId)
        if (resolvedRole) session.user.role = resolvedRole
      }
      return session
    },
  },
})
