import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? 'file:dev.db'
  const adapter = new PrismaLibSql({ url: dbUrl })
  const prisma = new PrismaClient({ adapter })

  try {
    const [adminPasswordHash, userPasswordHash] = await Promise.all([
      bcrypt.hash('admin', 12),
      bcrypt.hash('team0924', 12),
    ])

    const [adminUser] = await Promise.all([
      prisma.user.upsert({
        where: { username: 'po' },
        update: { passwordHash: adminPasswordHash, role: 'ADMIN' },
        create: { username: 'po', passwordHash: adminPasswordHash, role: 'ADMIN' },
      }),
      prisma.user.upsert({
        where: { username: 'teamo2' },
        update: { passwordHash: userPasswordHash, role: 'USER' },
        create: { username: 'teamo2', passwordHash: userPasswordHash, role: 'USER' },
      }),
    ])

    const legacyUsers = await prisma.user.findMany({
      where: { username: { notIn: ['po', 'teamo2'] } },
      select: { id: true, username: true },
    })

    for (const legacyUser of legacyUsers) {
      await prisma.project.updateMany({
        where: { userId: legacyUser.id },
        data: { userId: adminUser.id },
      })

      await prisma.user.delete({
        where: { id: legacyUser.id },
      })
    }

    console.log('Seed complete')
    console.log('- po / admin (ADMIN)')
    console.log('- teamo2 / team0924 (USER)')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
