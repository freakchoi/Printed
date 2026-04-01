import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user!.id! },
    include: { template: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    return NextResponse.json({
      ...project,
      values: JSON.parse(project.values),
      template: { ...project.template, fields: JSON.parse(project.template.fields) },
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

  const { id } = await params
  const { name, values } = await req.json()
  if (!name || values === undefined) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const updated = await prisma.project.updateMany({
    where: { id, userId: session.user!.id! },
    data: { name, values: JSON.stringify(values) },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
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
