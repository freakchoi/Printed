import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? 'file:dev.db'
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
