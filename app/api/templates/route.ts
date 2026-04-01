import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseSVGFields } from '@/lib/svg-parser'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.template.findMany({
    where: { parentId: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, category: true, thumbnail: true, fields: true, parentId: true,
      variants: { select: { id: true, name: true, category: true, thumbnail: true, fields: true, parentId: true } },
    },
  })
  return NextResponse.json(templates.map(t => ({
    ...t,
    fields: JSON.parse(t.fields),
    variants: t.variants.map(v => ({ ...v, fields: JSON.parse(v.fields) })),
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const name = formData.get('name') as string
  const category = formData.get('category') as string
  const parentId = formData.get('parentId') as string | null

  if (!file || !name || !category) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const svgString = await file.text()
  const fields = parseSVGFields(svgString)
  const filename = `${Date.now()}-${file.name}`
  const uploadDir = path.join(process.cwd(), 'uploads')
  const svgDir = path.join(uploadDir, 'svg')

  await mkdir(svgDir, { recursive: true })
  const svgPath = path.join(svgDir, filename)
  await writeFile(svgPath, svgString, 'utf-8')

  const template = await prisma.template.create({
    data: {
      name,
      category,
      svgPath,
      fields: JSON.stringify(fields),
      ...(parentId ? { parentId } : {}),
    },
  })

  return NextResponse.json({ ...template, fields }, { status: 201 })
}
