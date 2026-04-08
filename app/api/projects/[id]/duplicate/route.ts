import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { getProjectPersistenceCapabilities, normalizeActorIdentity, recordProjectActivityIfSupported } from '@/lib/project-activity.server'
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const capabilities = await getProjectPersistenceCapabilities(prisma)
  const body = await req.json().catch(() => ({})) as { actorClientId?: string; actorName?: string }
  const actor = normalizeActorIdentity(body)

  const { id } = await params
  const duplicateSourceSelect: Prisma.ProjectSelect = {
    id: true,
    name: true,
    values: true,
    sheetSnapshot: true,
    templateId: true,
    template: {
      include: {
        sheets: {
          select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true },
        },
      },
    },
  }
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user!.id! },
    select: duplicateSourceSelect,
  }) as unknown as {
    id: string
    name: string
    sheetSnapshot: string | null
    template: any
    templateId: string
    values: string
  } | null

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
    take: 1000,
  })
  const duplicateName = buildDuplicateName(project.name, new Set(siblings.map(item => item.name)))

  const duplicated = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name: duplicateName,
        templateId: project.templateId,
        userId: session.user!.id!,
        values: JSON.stringify(values),
        sheetSnapshot: JSON.stringify(sheetSnapshot),
        ...(capabilities.projectActorColumns ? {
          createdByActorName: actor.actorName,
          createdByActorClientId: actor.actorClientId,
          lastEditedByActorName: actor.actorName,
          lastEditedByActorClientId: actor.actorClientId,
        } : {}),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        ...(capabilities.projectActorColumns ? { createdByActorName: true, lastEditedByActorName: true } : {}),
      } satisfies Prisma.ProjectSelect,
    }) as unknown as {
      createdAt: Date
      createdByActorName?: string | null
      id: string
      lastEditedByActorName?: string | null
      name: string
      updatedAt: Date
    }
    await recordProjectActivityIfSupported(tx, capabilities, {
      action: 'DUPLICATE',
      actor,
      projectId: created.id,
      projectNameSnapshot: created.name,
      templateId: project.templateId,
      metadata: { sourceProjectId: project.id },
    })
    return created
  })

  return NextResponse.json({
    createdByActorName: capabilities.projectActorColumns ? (duplicated.createdByActorName ?? null) : null,
    id: duplicated.id,
    lastEditedByActorName: capabilities.projectActorColumns ? (duplicated.lastEditedByActorName ?? null) : null,
    name: duplicated.name,
    createdAt: duplicated.createdAt,
    updatedAt: duplicated.updatedAt,
    values,
    sheetSnapshot,
    template,
  }, { status: 201 })
}
