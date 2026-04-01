import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'

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

  const svgContent = await readFile(template.svgPath, 'utf-8')
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
  await prisma.template.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
