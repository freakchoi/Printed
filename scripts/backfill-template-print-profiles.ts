import 'dotenv/config'

import { prisma } from '../lib/prisma'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const templates = await prisma.template.findMany({
    select: {
      id: true,
      name: true,
      printColorProfileMode: true,
      adobeWorkingCmykPreset: true,
      customIccPath: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  let changedCount = 0

  for (const template of templates) {
    if (template.printColorProfileMode && (template.adobeWorkingCmykPreset || template.customIccPath)) {
      continue
    }

    changedCount += 1
    console.log([
      `[${template.id}] ${template.name}`,
      `before=${template.printColorProfileMode ?? 'null'}/${template.adobeWorkingCmykPreset ?? 'null'}`,
      'after=adobe-working-cmyk/FOGRA39',
    ].join(' | '))

    if (!dryRun) {
      await prisma.template.update({
        where: { id: template.id },
        data: {
          printColorProfileMode: 'adobe-working-cmyk',
          adobeWorkingCmykPreset: 'FOGRA39',
          customIccPath: null,
        },
      })
    }
  }

  console.log(`${dryRun ? 'dry-run' : 'updated'}: ${changedCount} template(s)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
