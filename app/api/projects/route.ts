import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProjectPersistenceCapabilities, normalizeActorIdentity, recordProjectActivityIfSupported } from '@/lib/project-activity.server'
import { buildTemplateDetail, hydrateSheetSvgAndFields } from '@/lib/template-server'
import { createProjectSheetSnapshots, normalizeProjectSheetSnapshot, normalizeProjectValues, reconcileProjectSheetSnapshotDimensions } from '@/lib/template-model'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templateId = req.nextUrl.searchParams.get('templateId')
  const capabilities = await getProjectPersistenceCapabilities(prisma)

  const listSelect: Prisma.ProjectSelect = {
    id: true,
    name: true,
    templateId: true,
    createdAt: true,
    updatedAt: true,
    ...(capabilities.projectActorColumns ? { createdByActorName: true, lastEditedByActorName: true } : {}),
    ...(capabilities.projectExportColumns ? { lastExportedAt: true, lastExportedByActorName: true } : {}),
  }
  const projects = await prisma.project.findMany({
    select: listSelect,
    where: {
      userId: session.user!.id!,
      ...(templateId ? { templateId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  }) as unknown as Array<{
    createdAt: Date
    createdByActorName?: string | null
    id: string
    lastEditedByActorName?: string | null
    lastExportedAt?: Date | null
    lastExportedByActorName?: string | null
    name: string
    templateId: string
    updatedAt: Date
  }>

  return NextResponse.json(projects.map(project => ({
    ...project,
    createdByActorName: capabilities.projectActorColumns ? (project.createdByActorName ?? null) : null,
    lastEditedByActorName: capabilities.projectActorColumns ? (project.lastEditedByActorName ?? null) : null,
    lastExportedAt: capabilities.projectExportColumns ? (project.lastExportedAt ?? null) : null,
    lastExportedByActorName: capabilities.projectExportColumns ? (project.lastExportedByActorName ?? null) : null,
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const capabilities = await getProjectPersistenceCapabilities(prisma)

  const { name, templateId, values, sheetSnapshot, actorName, actorClientId } = await req.json()
  if (!name?.trim() || !templateId || values === undefined) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { sheets: { select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true } } },
  })
  if (!template) return NextResponse.json({ error: '템플릿을 찾을 수 없습니다' }, { status: 404 })

  const detail = await buildTemplateDetail(template)
  const normalizedSheetSnapshot = reconcileProjectSheetSnapshotDimensions(
    sheetSnapshot !== undefined
      ? normalizeProjectSheetSnapshot(sheetSnapshot, detail.sheets)
      : createProjectSheetSnapshots(detail.sheets),
    detail.sheets,
  ).map((sheet) => {
    const hydrated = hydrateSheetSvgAndFields(sheet.svgContent, sheet.fields)
    return hydrated.svgContent === sheet.svgContent && hydrated.fields === sheet.fields
      ? sheet
      : { ...sheet, svgContent: hydrated.svgContent, fields: hydrated.fields }
  })
  const normalizedValues = normalizeProjectValues(values, normalizedSheetSnapshot)
  const actor = normalizeActorIdentity({ actorName, actorClientId })

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name: name.trim(),
        templateId,
        userId: session.user!.id!,
        values: JSON.stringify(normalizedValues),
        sheetSnapshot: JSON.stringify(normalizedSheetSnapshot),
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
        templateId: true,
        ...(capabilities.projectActorColumns ? { createdByActorName: true, lastEditedByActorName: true } : {}),
      } satisfies Prisma.ProjectSelect,
    }) as unknown as {
      createdAt: Date
      createdByActorName?: string | null
      id: string
      lastEditedByActorName?: string | null
      name: string
      templateId: string
      updatedAt: Date
    }
    await recordProjectActivityIfSupported(tx, capabilities, {
      action: 'CREATE',
      actor,
      projectId: created.id,
      projectNameSnapshot: created.name,
      templateId,
      metadata: { origin: 'manual-create' },
    })
    return created
  })

  return NextResponse.json({
    ...project,
    createdByActorName: capabilities.projectActorColumns ? (project.createdByActorName ?? null) : null,
    lastEditedByActorName: capabilities.projectActorColumns ? (project.lastEditedByActorName ?? null) : null,
    values: normalizedValues,
    sheetSnapshot: normalizedSheetSnapshot,
  }, { status: 201 })
}
