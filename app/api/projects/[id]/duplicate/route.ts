import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildTemplateDetail, hydrateSheetSvgAndFields } from '@/lib/template-server'
import { normalizeProjectSheetSnapshot, normalizeProjectValues, reconcileProjectSheetSnapshotDimensions } from '@/lib/template-model'

function buildDuplicateName(name: string, existingNames: Set<string>) {
  const baseName = `${name} 복사본`
  if (!existingNames.has(baseName)) return baseName

  let suffix = 2
  while (existingNames.has(`${baseName} ${suffix}`)) {
    suffix += 1
  }
  return `${baseName} ${suffix}`
}

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user!.id! },
    include: {
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
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const template = await buildTemplateDetail(project.template)
  const sheetSnapshot = reconcileProjectSheetSnapshotDimensions(
    normalizeProjectSheetSnapshot(project.sheetSnapshot ? JSON.parse(project.sheetSnapshot) : null, template.sheets),
    template.sheets,
  ).map((sheet) => {
    const hydrated = hydrateSheetSvgAndFields(sheet.svgContent, sheet.fields)
    return hydrated.svgContent === sheet.svgContent && hydrated.fields === sheet.fields
      ? sheet
      : { ...sheet, svgContent: hydrated.svgContent, fields: hydrated.fields }
  })
  const values = normalizeProjectValues(JSON.parse(project.values), sheetSnapshot)

  const siblings = await prisma.project.findMany({
    where: { userId: session.user!.id! },
    select: { name: true },
  })
  const duplicateName = buildDuplicateName(project.name, new Set(siblings.map(item => item.name)))

  const duplicated = await prisma.project.create({
    data: {
      name: duplicateName,
      templateId: project.templateId,
      userId: session.user!.id!,
      values: JSON.stringify(values),
      sheetSnapshot: JSON.stringify(sheetSnapshot),
    },
  })

  return NextResponse.json({
    id: duplicated.id,
    name: duplicated.name,
    createdAt: duplicated.createdAt,
    updatedAt: duplicated.updatedAt,
    values,
    sheetSnapshot,
    template,
  }, { status: 201 })
}
