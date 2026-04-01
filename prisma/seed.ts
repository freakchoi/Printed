import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Parse .env.local manually; ESM imports are hoisted so we read the file here
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      process.env[key] = val
    }
  } catch {
    // .env.local not found — fall through to defaults
  }
}

async function main() {
  loadEnvLocal()

  const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
  const adapter = new PrismaLibSql({ url: dbUrl })
  const prisma = new PrismaClient({ adapter })

  try {
    const passwordHash = await bcrypt.hash('printed2024', 12)
    await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: { username: 'admin', passwordHash },
    })
    console.log('Seed complete — admin / printed2024')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
