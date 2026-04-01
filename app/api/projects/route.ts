import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await prisma.project.findMany({
    where: { userId: session.user!.id! },
    orderBy: { updatedAt: 'desc' },
    include: { template: { select: { name: true, category: true } } },
  })
  return NextResponse.json(projects.map(p => ({ ...p, values: JSON.parse(p.values) })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, templateId, values } = await req.json()
  if (!name || !templateId || !values) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const project = await prisma.project.create({
    data: {
      name,
      templateId,
      userId: session.user!.id!,
      values: JSON.stringify(values),
    },
  })
  return NextResponse.json({ ...project, values }, { status: 201 })
}
