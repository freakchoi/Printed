import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { buildAutoCloneName, getProjectPersistenceCapabilities, normalizeActorIdentity, recordProjectActivityIfSupported } from '@/lib/project-activity.server'
import { prisma } from '@/lib/prisma'
import { buildTemplateDetail, hydrateProjectSheetSnapshots } from '@/lib/template-server'
import { normalizeProjectSheetSnapshot, normalizeProjectValues, reconcileProjectSheetSnapshotDimensions } from '@/lib/template-model'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const capabilities = await getProjectPersistenceCapabilities(prisma)

  const { id } = await params
  const getSelect: Prisma.ProjectSelect = {
    id: true,
    name: true,
    values: true,
    sheetSnapshot: true,
    createdAt: true,
    updatedAt: true,
    userId: true,
    templateId: true,
    ...(capabilities.projectActorColumns ? { createdByActorName: true, lastEditedByActorName: true } : {}),
    ...(capabilities.projectExportColumns ? { lastExportedAt: true, lastExportedByActorName: true } : {}),
    template: {
      include: { sheets: { select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true } } },
    },
  }
  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: getSelect,
  }) as unknown as {
    createdAt: Date
    createdByActorName?: string | null
    id: string
    lastEditedByActorName?: string | null
    lastExportedAt?: Date | null
    lastExportedByActorName?: string | null
    name: string
    sheetSnapshot: string | null
    template: any
    templateId: string
    updatedAt: Date
    userId: string
    values: string
  } | null
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const template = await buildTemplateDetail(project.template)
    const parsedSnapshot = project.sheetSnapshot ? JSON.parse(project.sheetSnapshot) : null
    const normalizedSnapshot = normalizeProjectSheetSnapshot(parsedSnapshot, template.sheets)
    const sheetSnapshot = hydrateProjectSheetSnapshots(reconcileProjectSheetSnapshotDimensions(normalizedSnapshot, template.sheets))
    const values = normalizeProjectValues(JSON.parse(project.values), sheetSnapshot)

    return NextResponse.json({
      ...project,
      createdByActorName: capabilities.projectActorColumns ? (project.createdByActorName ?? null) : null,
      lastEditedByActorName: capabilities.projectActorColumns ? (project.lastEditedByActorName ?? null) : null,
      lastExportedAt: capabilities.projectExportColumns ? (project.lastExportedAt ?? null) : null,
      lastExportedByActorName: capabilities.projectExportColumns ? (project.lastExportedByActorName ?? null) : null,
      values,
      template,
      sheetSnapshot,
    })
  } catch {
    return NextResponse.json({ error: '데이터 파싱 오류' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const capabilities = await getProjectPersistenceCapabilities(prisma)

  const { id } = await params
  const { name, values, sheetSnapshot, actorName, actorClientId, baseUpdatedAt } = await req.json() as {
    actorClientId?: string
    actorName?: string
    baseUpdatedAt?: string
    name?: string
    sheetSnapshot?: unknown
    values?: unknown
  }
  if (name === undefined && values === undefined && sheetSnapshot === undefined) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const putSelect: Prisma.ProjectSelect = {
    id: true,
    name: true,
    values: true,
    sheetSnapshot: true,
    createdAt: true,
    updatedAt: true,
    templateId: true,
    ...(capabilities.projectActorColumns ? { createdByActorName: true } : {}),
    template: {
      include: { sheets: { select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true } } },
    },
  }
  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: putSelect,
  }) as unknown as {
    createdAt: Date
    createdByActorName?: string | null
    id: string
    name: string
    sheetSnapshot: string | null
    template: any
    templateId: string
    updatedAt: Date
    values: string
  } | null
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const template = await buildTemplateDetail(project.template)
  const actor = normalizeActorIdentity({ actorName, actorClientId })
  const currentSheetSnapshot = hydrateProjectSheetSnapshots(reconcileProjectSheetSnapshotDimensions(normalizeProjectSheetSnapshot(
    project.sheetSnapshot ? JSON.parse(project.sheetSnapshot) : null,
    template.sheets,
  ), template.sheets))
  const nextName = name !== undefined ? name.trim() : project.name
  const nextSnapshot = sheetSnapshot !== undefined
    ? hydrateProjectSheetSnapshots(reconcileProjectSheetSnapshotDimensions(
      normalizeProjectSheetSnapshot(sheetSnapshot, template.sheets),
      template.sheets,
    ))
    : currentSheetSnapshot
  const nextValues = values !== undefined
    ? normalizeProjectValues(values, nextSnapshot)
    : normalizeProjectValues(JSON.parse(project.values), nextSnapshot)
  const data: {
    lastEditedByActorClientId?: string | null
    lastEditedByActorName?: string | null
    name?: string
    sheetSnapshot?: string
    values?: string
  } = {}

  if (name !== undefined) {
    if (!nextName) {
      return NextResponse.json({ error: '파일 이름을 입력해주세요.' }, { status: 400 })
    }
    data.name = nextName
  }

  if (values !== undefined) {
    data.values = JSON.stringify(nextValues)
  }

  if (sheetSnapshot !== undefined) {
    data.sheetSnapshot = JSON.stringify(nextSnapshot)
    if (values === undefined) {
      data.values = JSON.stringify(nextValues)
    }
  }

  data.lastEditedByActorName = actor.actorName
  data.lastEditedByActorClientId = actor.actorClientId
  if (!capabilities.projectActorColumns) {
    delete data.lastEditedByActorName
    delete data.lastEditedByActorClientId
  }

  const hasConflict = Boolean(
    baseUpdatedAt &&
    Number.isFinite(new Date(baseUpdatedAt).getTime()) &&
    new Date(baseUpdatedAt).getTime() !== new Date(project.updatedAt).getTime()
  )

  if (hasConflict) {
    const siblings = await prisma.project.findMany({
      where: { userId },
      select: { name: true },
      take: 1000,
    })
    const resolvedName = buildAutoCloneName(nextName, new Set(siblings.map(item => item.name)))
    const duplicated = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: resolvedName,
          templateId: project.templateId,
          userId,
          values: JSON.stringify(nextValues),
          sheetSnapshot: JSON.stringify(nextSnapshot),
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
          ...(capabilities.projectActorColumns ? { lastEditedByActorName: true } : {}),
        } satisfies Prisma.ProjectSelect,
      }) as unknown as {
        createdAt: Date
        id: string
        lastEditedByActorName?: string | null
        name: string
        updatedAt: Date
      }

      await recordProjectActivityIfSupported(tx, capabilities, {
        action: 'AUTO_CLONE_ON_CONFLICT',
        actor,
        projectId: created.id,
        projectNameSnapshot: created.name,
        templateId: project.templateId,
        metadata: {
          baseUpdatedAt,
          sourceProjectId: project.id,
        },
      })
      return created
    })

    return NextResponse.json({
      ok: true,
      conflict: true,
      id: duplicated.id,
      resolvedProjectId: duplicated.id,
      resolvedName: duplicated.name,
      name: duplicated.name,
      createdAt: duplicated.createdAt,
      updatedAt: duplicated.updatedAt,
      lastEditedByActorName: capabilities.projectActorColumns ? (duplicated.lastEditedByActorName ?? null) : null,
    })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.project.update({
      where: { id: project.id },
      data,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        ...(capabilities.projectActorColumns ? { lastEditedByActorName: true } : {}),
      } satisfies Prisma.ProjectSelect,
    }) as unknown as {
      createdAt: Date
      id: string
      lastEditedByActorName?: string | null
      name: string
      updatedAt: Date
    }
    await recordProjectActivityIfSupported(tx, capabilities, {
      action: 'SAVE',
      actor,
      projectId: saved.id,
      projectNameSnapshot: saved.name,
      templateId: project.templateId,
      metadata: {
        includedName: name !== undefined,
        includedSheetSnapshot: sheetSnapshot !== undefined,
        includedValues: values !== undefined,
      },
    })
    return saved
  })

  return NextResponse.json({
    ok: true,
    conflict: false,
    id: updated.id,
    name: updated.name,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    lastEditedByActorName: capabilities.projectActorColumns ? (updated.lastEditedByActorName ?? null) : null,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({})) as { sheetSnapshot?: unknown; values?: unknown }

  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: { id: true, sheetSnapshot: true, values: true, template: { include: { sheets: { select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true } } } } },
  }) as unknown as { id: string; sheetSnapshot: string | null; values: string; template: any } | null
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.sheetSnapshot === undefined && body.values === undefined) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const template = await buildTemplateDetail(project.template)
  const currentSnapshot = normalizeProjectSheetSnapshot(
    project.sheetSnapshot ? JSON.parse(project.sheetSnapshot) : null,
    template.sheets,
  )
  const data: { sheetSnapshot?: string; values?: string } = {}
  const nextSnapshot = body.sheetSnapshot !== undefined
    ? normalizeProjectSheetSnapshot(body.sheetSnapshot, template.sheets)
    : currentSnapshot
  if (body.sheetSnapshot !== undefined) data.sheetSnapshot = JSON.stringify(nextSnapshot)
  if (body.values !== undefined) data.values = JSON.stringify(normalizeProjectValues(body.values, nextSnapshot))

  await prisma.project.update({ where: { id: project.id }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = session.user?.role === 'ADMIN'
  const capabilities = await getProjectPersistenceCapabilities(prisma)
  const body = await req.json().catch(() => ({})) as { actorClientId?: string; actorName?: string }
  const actor = normalizeActorIdentity(body)

  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { id, ...(isAdmin ? {} : { userId }) },
    select: {
      id: true,
      name: true,
      templateId: true,
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    await recordProjectActivityIfSupported(tx, capabilities, {
      action: 'DELETE',
      actor,
      projectId: project.id,
      projectNameSnapshot: project.name,
      templateId: project.templateId,
      metadata: { origin: 'manual-delete' },
    })
    await tx.project.delete({
      where: { id: project.id },
    })
  })

  return NextResponse.json({ ok: true })
}
