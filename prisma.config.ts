import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Load .env.local so DATABASE_URL is available when running Prisma CLI commands
config({ path: '.env.local' })

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
