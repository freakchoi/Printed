import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile, unlink } from 'fs/promises'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const template = await prisma.template.findUnique({
    where: { id },
    include: { variants: true },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let svgContent: string
  try {
    svgContent = await readFile(template.svgPath, 'utf-8')
  } catch {
    return NextResponse.json({ error: 'SVG 파일을 찾을 수 없습니다' }, { status: 404 })
  }
  return NextResponse.json({
    ...template,
    fields: JSON.parse(template.fields),
    variants: template.variants.map(v => ({ ...v, fields: JSON.parse(v.fields) })),
    svgContent,
  })
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const template = await prisma.template.findUnique({ where: { id }, select: { id: true, svgPath: true } })
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

  await prisma.template.delete({ where: { id } })
  try { await unlink(template.svgPath) } catch { /* already gone */ }
  return NextResponse.json({ ok: true })
}
