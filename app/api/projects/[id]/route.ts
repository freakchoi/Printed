import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildTemplateDetail, hydrateProjectSheetSnapshots } from '@/lib/template-server'
import { normalizeProjectSheetSnapshot, normalizeProjectValues, reconcileProjectSheetSnapshotDimensions } from '@/lib/template-model'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user!.id! },
    include: {
      template: {
        include: { sheets: { select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true } } },
      },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const template = await buildTemplateDetail(project.template)
    const parsedSnapshot = project.sheetSnapshot ? JSON.parse(project.sheetSnapshot) : null
    const normalizedSnapshot = normalizeProjectSheetSnapshot(parsedSnapshot, template.sheets)
    const sheetSnapshot = hydrateProjectSheetSnapshots(reconcileProjectSheetSnapshotDimensions(normalizedSnapshot, template.sheets))
    const values = normalizeProjectValues(JSON.parse(project.values), sheetSnapshot)

    const shouldPersistSnapshot = !project.sheetSnapshot || JSON.stringify(normalizedSnapshot) !== JSON.stringify(sheetSnapshot)
    if (shouldPersistSnapshot) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          sheetSnapshot: JSON.stringify(sheetSnapshot),
          values: JSON.stringify(values),
        },
      })
    }

    return NextResponse.json({ ...project, values, template, sheetSnapshot })
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

  const { id } = await params
  const { name, values, sheetSnapshot } = await req.json() as { name?: string; values?: unknown; sheetSnapshot?: unknown }
  if (name === undefined && values === undefined && sheetSnapshot === undefined) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user!.id! },
    include: {
      template: {
        include: { sheets: { select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true } } },
      },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const template = await buildTemplateDetail(project.template)
  const currentSheetSnapshot = hydrateProjectSheetSnapshots(reconcileProjectSheetSnapshotDimensions(normalizeProjectSheetSnapshot(
    project.sheetSnapshot ? JSON.parse(project.sheetSnapshot) : null,
    template.sheets,
  ), template.sheets))

  const data: { name?: string; values?: string; sheetSnapshot?: string } = {}

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: '파일 이름을 입력해주세요.' }, { status: 400 })
    }
    data.name = name.trim()
  }

  if (values !== undefined) {
    const normalizedValues = normalizeProjectValues(values, sheetSnapshot !== undefined
      ? reconcileProjectSheetSnapshotDimensions(normalizeProjectSheetSnapshot(sheetSnapshot, template.sheets), template.sheets)
      : currentSheetSnapshot)
    data.values = JSON.stringify(normalizedValues)
  }

  if (sheetSnapshot !== undefined) {
    const normalizedSnapshot = hydrateProjectSheetSnapshots(reconcileProjectSheetSnapshotDimensions(
      normalizeProjectSheetSnapshot(sheetSnapshot, template.sheets),
      template.sheets,
    ))
    data.sheetSnapshot = JSON.stringify(normalizedSnapshot)
    if (values === undefined) {
      const normalizedValues = normalizeProjectValues(JSON.parse(project.values), normalizedSnapshot)
      data.values = JSON.stringify(normalizedValues)
    }
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    ok: true,
    id: updated.id,
    name: updated.name,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  })
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const deleted = await prisma.project.deleteMany({
    where: { id, userId: session.user!.id! },
  })
  if (deleted.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
