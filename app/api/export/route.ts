import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getProjectPersistenceCapabilities, normalizeActorIdentity, recordProjectActivityIfSupported } from '@/lib/project-activity.server'
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

// 허용값 검증용 상수
const VALID_SELECTION_MODES = ['all', 'range'] as const
const VALID_IMAGE_MODES = ['combined', 'separate'] as const
const VALID_COMBINED_DIRECTIONS = ['horizontal', 'vertical'] as const
const VALID_RASTER_MODES = ['default', 'high-res'] as const

function getUserId(session: { user?: { id?: string | null } } | null) {
  const id = session?.user?.id
  if (!id) throw new Error('Session user ID not found')
  return id
}

async function recordExportActivity(args: {
  actor: ReturnType<typeof normalizeActorIdentity>
  baseName: string
  capabilities: Awaited<ReturnType<typeof getProjectPersistenceCapabilities>>
  format: 'pdf' | 'png' | 'jpeg'
  projectId: string
  projectName: string
  templateId: string
}) {
  if (!args.capabilities.projectExportColumns && !args.capabilities.projectActivityTable) return

  try {
    const exportedAt = new Date()
    await prisma.$transaction(async (tx) => {
      if (args.capabilities.projectExportColumns) {
        await tx.project.update({
          where: { id: args.projectId },
          data: {
            lastExportedAt: exportedAt,
            lastExportedByActorName: args.actor.actorName,
            lastExportedByActorClientId: args.actor.actorClientId,
          },
        })
      }

      await recordProjectActivityIfSupported(tx, args.capabilities, {
        action: 'EXPORT',
        actor: args.actor,
        projectId: args.projectId,
        projectNameSnapshot: args.projectName,
        templateId: args.templateId,
        metadata: {
          fileName: args.baseName,
          format: args.format,
        },
      })
    })
  } catch (error) {
    console.warn('[Printed] Export audit logging failed:', error)
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const capabilities = await getProjectPersistenceCapabilities(prisma)

  try {
    const { projectId, format, fileName, rasterMode, selectionMode = 'all', imageMode = 'combined', combinedDirection = 'horizontal', rangeStart, rangeEnd, values: rawValues, actorName, actorClientId } = await req.json() as {
      actorClientId?: string
      actorName?: string
      combinedDirection?: CombinedImageDirection
      fileName?: string
      imageMode?: ImageOutputMode
      projectId: string
      format: 'pdf' | 'png' | 'jpeg'
      rangeEnd?: number
      rangeStart?: number
      selectionMode?: ImageSelectionMode
      rasterMode?: RasterMode
      values?: unknown
    }
    const actor = normalizeActorIdentity({ actorName, actorClientId })

    if (!projectId || !format) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }
    if (!['pdf', 'png', 'jpeg'].includes(format)) {
      return NextResponse.json({ error: '지원하지 않는 형식' }, { status: 400 })
    }

    // Enum 값 검증
    if (selectionMode && !VALID_SELECTION_MODES.includes(selectionMode as any)) {
      return NextResponse.json({ error: '잘못된 selectionMode 값' }, { status: 400 })
    }
    if (imageMode && !VALID_IMAGE_MODES.includes(imageMode as any)) {
      return NextResponse.json({ error: '잘못된 imageMode 값' }, { status: 400 })
    }
    if (combinedDirection && !VALID_COMBINED_DIRECTIONS.includes(combinedDirection as any)) {
      return NextResponse.json({ error: '잘못된 combinedDirection 값' }, { status: 400 })
    }
    if (rasterMode && !VALID_RASTER_MODES.includes(rasterMode as any)) {
      return NextResponse.json({ error: '잘못된 rasterMode 값' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: getUserId(session) },
      select: {
        id: true,
        name: true,
        values: true,
        sheetSnapshot: true,
        templateId: true,
        template: {
          include: { sheets: { select: { id: true, name: true, order: true, svgPath: true, fields: true, width: true, height: true, unit: true, widthPx: true, heightPx: true } } },
        },
      } as any,
    }) as unknown as {
      id: string
      name: string
      sheetSnapshot: string | null
      template: any
      templateId: string
      values: string
    } | null
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
    if (sheetSnapshot.length === 0) {
      return NextResponse.json({ error: '대지 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    if (format === 'png' || format === 'jpeg') {
      if (selectionMode === 'range' && (rangeStart === undefined || rangeEnd === undefined)) {
        return NextResponse.json({ error: '범위를 선택할 때는 시작과 끝 번호가 필요합니다.' }, { status: 400 })
      }

      const selectedSheets = selectRenderableSheets(sheetSnapshot, {
        selectionMode,
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
        await recordExportActivity({
          actor,
          baseName,
          capabilities,
          format,
          projectId: project.id,
          projectName: project.name,
          templateId: project.templateId,
        })
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
      await recordExportActivity({
        actor,
        baseName,
        capabilities,
        format,
        projectId: project.id,
        projectName: project.name,
        templateId: project.templateId,
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

    const buffer = await exportSheetsToPDF(sheetSnapshot, values, template.printSettings, baseName)
    await recordExportActivity({
      actor,
      baseName,
      capabilities,
      format,
      projectId: project.id,
      projectName: project.name,
      templateId: project.templateId,
    })
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
