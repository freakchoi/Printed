import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildExportSVG,
  exportSheetsToPDF,
  exportRenderableSheetsToCombinedImage,
  exportRenderableSheetsToSeparateArchive,
  selectRenderableSheets,
  type RasterMode,
} from '@/lib/export'
import { buildTemplateDetail, hydrateProjectSheetSnapshots } from '@/lib/template-server'
import {
  normalizeProjectSheetSnapshot,
  normalizeProjectValues,
  reconcileProjectSheetSnapshotDimensions,
  type CombinedImageDirection,
  type ImageOutputMode,
  type ImageSelectionMode,
} from '@/lib/template-model'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { projectId, format, fileName, sheetId, rasterMode, selectionMode = 'current', imageMode = 'combined', combinedDirection = 'horizontal', rangeStart, rangeEnd, values: rawValues } = await req.json() as {
      combinedDirection?: CombinedImageDirection
      fileName?: string
      imageMode?: ImageOutputMode
      projectId: string
      format: 'pdf' | 'png' | 'jpeg'
      rangeEnd?: number
      rangeStart?: number
      selectionMode?: ImageSelectionMode
      sheetId?: string
      rasterMode?: RasterMode
      values?: unknown
    }

    if (!projectId || !format) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }
    if (!['pdf', 'png', 'jpeg'].includes(format)) {
      return NextResponse.json({ error: '지원하지 않는 형식' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user!.id! },
      include: {
        template: {
          include: { sheets: { select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true } } },
        },
      },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let template
    let sheetSnapshot
    let values
    try {
      template = await buildTemplateDetail(project.template)
      sheetSnapshot = hydrateProjectSheetSnapshots(reconcileProjectSheetSnapshotDimensions(normalizeProjectSheetSnapshot(
        project.sheetSnapshot ? JSON.parse(project.sheetSnapshot) : null,
        template.sheets,
      ), template.sheets))
      values = normalizeProjectValues(rawValues ?? JSON.parse(project.values), sheetSnapshot)
    } catch {
      return NextResponse.json({ error: '프로젝트 데이터 파싱 오류' }, { status: 422 })
    }

    const baseName = (fileName?.trim() || project.name).trim()
    const encodedName = encodeURIComponent(baseName)
    const activeSheet = sheetSnapshot.find(sheet => sheet.id === sheetId) ?? sheetSnapshot[0]
    if (!activeSheet) {
      return NextResponse.json({ error: '대지 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    if (format === 'png' || format === 'jpeg') {
      if (selectionMode === 'range' && (rangeStart === undefined || rangeEnd === undefined)) {
        return NextResponse.json({ error: '범위를 선택할 때는 시작과 끝 번호가 필요합니다.' }, { status: 400 })
      }

      const selectedSheets = selectRenderableSheets(sheetSnapshot, {
        selectionMode,
        currentSheetId: activeSheet.id,
        rangeStart,
        rangeEnd,
      })

      if (selectedSheets.length === 0) {
        return NextResponse.json({ error: '내보낼 대지를 찾을 수 없습니다.' }, { status: 404 })
      }

      const renderableSheets = selectedSheets.map(sheet => ({
        id: sheet.id,
        name: sheet.name,
        order: sheet.order,
        svgString: buildExportSVG(sheet.svgContent, values[sheet.id] ?? {}),
      }))

      if (imageMode === 'separate') {
        const result = await exportRenderableSheetsToSeparateArchive(renderableSheets, format, { rasterMode: rasterMode ?? 'high-res' })
        return new NextResponse(new Uint8Array(result.buffer), {
          headers: {
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${project.name}-${result.fileName}`)}`,
          },
        })
      }

      const buffer = await exportRenderableSheetsToCombinedImage(renderableSheets, format, {
        rasterMode: rasterMode ?? 'high-res',
        combinedDirection,
      })
      const mime = format === 'png' ? 'image/png' : 'image/jpeg'
      const extension = format === 'jpeg' ? 'jpg' : format
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}.${extension}`,
        },
      })
    }

    const buffer = await exportSheetsToPDF(sheetSnapshot, values, template.printSettings)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}.pdf`,
      },
    })
  } catch (error) {
    console.error('Export failed:', error)
    const message = error instanceof Error ? error.message : '내보내기에 실패했습니다'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
