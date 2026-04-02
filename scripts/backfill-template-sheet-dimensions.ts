import 'dotenv/config'

import { readFile } from 'fs/promises'
import { prisma } from '../lib/prisma'
import { getSvgDimensions } from '../lib/svg-dimensions'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const sheets = await prisma.templateSheet.findMany({
    select: {
      id: true,
      name: true,
      svgPath: true,
      width: true,
      height: true,
      unit: true,
      widthPx: true,
      heightPx: true,
    },
    orderBy: [
      { templateId: 'asc' },
      { order: 'asc' },
    ],
  })

  let changedCount = 0

  for (const sheet of sheets) {
    const svgContent = await readFile(sheet.svgPath, 'utf-8')
    const next = getSvgDimensions(svgContent)
    const hasChanged =
      sheet.width !== next.width ||
      sheet.height !== next.height ||
      sheet.unit !== next.unit ||
      sheet.widthPx !== next.widthPx ||
      sheet.heightPx !== next.heightPx

    if (!hasChanged) continue
    changedCount += 1

    const summary = [
      `[${sheet.id}] ${sheet.name}`,
      `stored=${sheet.width}x${sheet.height}${sheet.unit} (${sheet.widthPx}x${sheet.heightPx}px)`,
      `next=${next.width}x${next.height}${next.unit} (${next.widthPx}x${next.heightPx}px)`,
      `source=${next.source}`,
    ].join(' | ')

    console.log(summary)

    if (!dryRun) {
      await prisma.templateSheet.update({
        where: { id: sheet.id },
        data: {
          width: next.width,
          height: next.height,
          unit: next.unit,
          widthPx: next.widthPx,
          heightPx: next.heightPx,
        },
      })
    }
  }

  console.log(`${dryRun ? 'dry-run' : 'updated'}: ${changedCount} sheet(s)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
