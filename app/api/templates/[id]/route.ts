import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireAdmin, requireSession } from '@/lib/authorization'
import { prisma } from '@/lib/prisma'
import { readFile, unlink } from 'fs/promises'
import { buildTemplateDetail, invalidateTemplateDetailCache } from '@/lib/template-server'
import { getLegacySheetId } from '@/lib/template-model'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const authError = requireSession(session)
  if (authError) return authError

  const { id } = await params
  const template = await prisma.template.findUnique({
    where: { id },
    include: {
      sheets: {
        select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true },
        orderBy: { order: 'asc' },
      },
    },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    return NextResponse.json(await buildTemplateDetail(template))
  } catch {
    return NextResponse.json({ error: 'SVG 파일을 찾을 수 없습니다' }, { status: 404 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const authError = requireAdmin(session)
  if (authError) return authError

  const { id } = await params
  const body = await req.json() as {
    name?: string
    category?: string
    sheets?: Array<{ id: string; name: string; order?: number }>
  }
  const trimmedName = typeof body.name === 'string' ? body.name.trim() : null
  const trimmedCategory = typeof body.category === 'string' ? body.category.trim() : null

  if (!trimmedName && !trimmedCategory && (!body.sheets || body.sheets.length === 0)) {
    return NextResponse.json({ error: '수정할 대지 정보가 없습니다' }, { status: 400 })
  }

  const template = await prisma.template.findUnique({
    where: { id },
    include: { sheets: true },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const legacySheetId = getLegacySheetId(template.id)
  const existingSheetIds = new Set(template.sheets.map(sheet => sheet.id))
  const updates = (body.sheets ?? []).map((sheet, index) => ({
    id: sheet.id,
    name: sheet.name.trim(),
    order: sheet.order ?? index,
  }))

  if (trimmedName === '') {
    return NextResponse.json({ error: '템플릿명은 비워둘 수 없습니다' }, { status: 400 })
  }
  if (trimmedCategory === '') {
    return NextResponse.json({ error: '분류는 비워둘 수 없습니다' }, { status: 400 })
  }
  if (updates.some(sheet => !sheet.name)) {
    return NextResponse.json({ error: '대지명은 비워둘 수 없습니다' }, { status: 400 })
  }

  await prisma.$transaction(async tx => {
    if (trimmedName || trimmedCategory) {
      await tx.template.update({
        where: { id: template.id },
        data: {
          ...(trimmedName ? { name: trimmedName } : {}),
          ...(trimmedCategory ? { category: trimmedCategory } : {}),
        },
      })
    }

    if (updates.length > 0) {
      const legacyUpdate = updates.find(sheet => sheet.id === legacySheetId)
      if (legacyUpdate && template.sheets.length === 0) {
        await tx.templateSheet.create({
          data: {
            templateId: template.id,
            name: legacyUpdate.name,
            order: legacyUpdate.order,
            svgPath: template.svgPath,
            fields: template.fields,
            width: null,
            height: null,
            unit: null,
            widthPx: null,
            heightPx: null,
          },
        })
      }

      await Promise.all(updates
        .filter(sheet => existingSheetIds.has(sheet.id))
        .map(sheet => tx.templateSheet.update({
          where: { id: sheet.id },
          data: { name: sheet.name, order: sheet.order },
        })))
    }
  })

  invalidateTemplateDetailCache(id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const authError = requireAdmin(session)
  if (authError) return authError

  const { id } = await params
  const template = await prisma.template.findUnique({
    where: { id },
    include: { sheets: { select: { svgPath: true } } },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [childCount, projectCount] = await Promise.all([
    prisma.template.count({ where: { parentId: id } }),
    prisma.project.count({ where: { templateId: id } }),
  ])
  if (childCount > 0 || projectCount > 0) {
    return NextResponse.json(
      { error: '하위 변형 또는 프로젝트가 존재하여 삭제할 수 없습니다' },
      { status: 409 }
    )
  }

  const svgPaths = template.sheets.length > 0
    ? template.sheets.map(sheet => sheet.svgPath)
    : [template.svgPath]

  await prisma.template.delete({ where: { id } })
  await Promise.all(svgPaths.map(svgPath => unlink(svgPath).catch(() => {})))
  invalidateTemplateDetailCache(id)

  return NextResponse.json({ ok: true })
}
