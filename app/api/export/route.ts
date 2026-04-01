import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildExportSVG, exportToPDF, exportToImage } from '@/lib/export'
import { readFile } from 'fs/promises'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, format } = await req.json() as { projectId: string; format: 'pdf' | 'png' | 'jpeg' }

  if (!projectId || !format) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }
  if (!['pdf', 'png', 'jpeg'].includes(format)) {
    return NextResponse.json({ error: '지원하지 않는 형식' }, { status: 400 })
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user!.id! },
    include: { template: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let svgContent: string
  try {
    svgContent = await readFile(project.template.svgPath, 'utf-8')
  } catch {
    return NextResponse.json({ error: 'SVG 파일을 찾을 수 없습니다' }, { status: 404 })
  }

  const values: Record<string, string> = JSON.parse(project.values)
  const finalSVG = buildExportSVG(svgContent, values)

  // PNG/JPG → RGB (화면/웹용)
  if (format === 'png' || format === 'jpeg') {
    const buffer = await exportToImage(finalSVG, format)
    const mime = format === 'png' ? 'image/png' : 'image/jpeg'
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${project.name}.${format}"`,
      },
    })
  }

  // PDF → CMYK (인쇄소 납품용)
  const buffer = await exportToPDF(finalSVG)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${project.name}.pdf"`,
    },
  })
}
