import 'dotenv/config'

import { prisma } from '../lib/prisma'
import { buildTemplateDetail } from '../lib/template-server'
import { normalizeProjectSheetSnapshot, reconcileProjectSheetSnapshotDimensions } from '../lib/template-model'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      sheetSnapshot: true,
      template: {
        include: {
          sheets: {
            select: {
              id: true,
              name: true,
              order: true,
              svgPath: true,
              fields: true,
              width: true,
              height: true,
              unit: true,
              widthPx: true,
              heightPx: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  let changedCount = 0

  for (const project of projects) {
    const template = await buildTemplateDetail(project.template)
    const normalizedSnapshot = normalizeProjectSheetSnapshot(
      project.sheetSnapshot ? JSON.parse(project.sheetSnapshot) : null,
      template.sheets,
    )
    const reconciledSnapshot = reconcileProjectSheetSnapshotDimensions(normalizedSnapshot, template.sheets)

    if (JSON.stringify(normalizedSnapshot) === JSON.stringify(reconciledSnapshot)) {
      continue
    }

    changedCount += 1
    const firstBefore = normalizedSnapshot[0]
    const firstAfter = reconciledSnapshot[0]

    console.log([
      `[${project.id}] ${project.name}`,
      `before=${firstBefore?.width}x${firstBefore?.height}${firstBefore?.unit} (${firstBefore?.widthPx}x${firstBefore?.heightPx}px)`,
      `after=${firstAfter?.width}x${firstAfter?.height}${firstAfter?.unit} (${firstAfter?.widthPx}x${firstAfter?.heightPx}px)`,
    ].join(' | '))

    if (!dryRun) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          sheetSnapshot: JSON.stringify(reconciledSnapshot),
        },
      })
    }
  }

  console.log(`${dryRun ? 'dry-run' : 'updated'}: ${changedCount} project(s)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
