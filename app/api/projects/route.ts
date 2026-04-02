import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildTemplateDetail, hydrateSheetSvgAndFields } from '@/lib/template-server'
import { createProjectSheetSnapshots, normalizeProjectSheetSnapshot, normalizeProjectValues, reconcileProjectSheetSnapshotDimensions } from '@/lib/template-model'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templateId = req.nextUrl.searchParams.get('templateId')

  const projects = await prisma.project.findMany({
    where: {
      userId: session.user!.id!,
      ...(templateId ? { templateId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  })

  try {
    return NextResponse.json(projects.map(project => ({ ...project, values: JSON.parse(project.values) })))
  } catch {
    return NextResponse.json({ error: '데이터 파싱 오류' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, templateId, values, sheetSnapshot } = await req.json()
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

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      templateId,
      userId: session.user!.id!,
      values: JSON.stringify(normalizedValues),
      sheetSnapshot: JSON.stringify(normalizedSheetSnapshot),
    },
  })
  return NextResponse.json({ ...project, values: normalizedValues, sheetSnapshot: normalizedSheetSnapshot }, { status: 201 })
}
