import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireAdmin, requireSession } from '@/lib/authorization'
import { prisma } from '@/lib/prisma'
import { normalizeSVGForEditing, extractSVGFontFamilies } from '@/lib/svg-parser'
import { ensureFontsDownloaded } from '@/lib/font-downloader.server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { buildTemplateListItem } from '@/lib/template-server'
import { getSvgDimensions } from '@/lib/svg-dimensions'
import { ADOBE_WORKING_CMYK_PRESETS } from '@/lib/print-color'
import type { AdobeWorkingCmykPreset, PrintColorProfileMode } from '@/lib/template-model'

function asSvgFiles(input: FormDataEntryValue[]) {
  return input.filter((entry): entry is File => entry instanceof File)
}

function makeSafeFilename(fileName: string, index: number) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${Date.now()}-${index}-${safeName}`
}

export async function GET() {
  const session = await auth()
  const authError = requireSession(session)
  if (authError) return authError

  const templates = await prisma.template.findMany({
    where: { parentId: null },
    orderBy: { createdAt: 'desc' },
    include: {
      sheets: {
        select: { id: true, name: true, order: true, svgPath: true, width: true, height: true, unit: true, widthPx: true, heightPx: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  return NextResponse.json(await Promise.all(templates.map(buildTemplateListItem)))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const authError = requireAdmin(session)
  if (authError) return authError

  const formData = await req.formData()
  const rawFiles = asSvgFiles(formData.getAll('files'))
  const singleFile = formData.get('file')
  const files = rawFiles.length > 0
    ? rawFiles
    : (singleFile instanceof File ? [singleFile] : [])

  const rawName = formData.get('name')
  const rawCategory = formData.get('category')
  const rawPrintColorProfileMode = formData.get('printColorProfileMode')
  const rawAdobeWorkingCmykPreset = formData.get('adobeWorkingCmykPreset')
  const customIcc = formData.get('customIcc')
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  const category = typeof rawCategory === 'string' ? rawCategory.trim() : ''
  const printColorProfileMode = (
    typeof rawPrintColorProfileMode === 'string' ? rawPrintColorProfileMode.trim() : 'adobe-working-cmyk'
  ) as PrintColorProfileMode
  const adobeWorkingCmykPreset = (
    typeof rawAdobeWorkingCmykPreset === 'string' ? rawAdobeWorkingCmykPreset.trim() : 'FOGRA39'
  ) as AdobeWorkingCmykPreset

  if (files.length === 0 || !name || !category) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  if (!['adobe-working-cmyk', 'custom-icc'].includes(printColorProfileMode)) {
    return NextResponse.json({ error: '지원하지 않는 인쇄용 CMYK 기준입니다.' }, { status: 400 })
  }

  if (printColorProfileMode === 'adobe-working-cmyk' && !rawAdobeWorkingCmykPreset) {
    return NextResponse.json({ error: '인쇄용 CMYK 프로파일을 선택해주세요.' }, { status: 400 })
  }

  if (
    printColorProfileMode === 'adobe-working-cmyk' &&
    !ADOBE_WORKING_CMYK_PRESETS.some(p => p.value === adobeWorkingCmykPreset)
  ) {
    return NextResponse.json({ error: '지원하지 않는 CMYK 프로파일 프리셋입니다.' }, { status: 400 })
  }

  if (printColorProfileMode === 'custom-icc' && !(customIcc instanceof File)) {
    return NextResponse.json({ error: '사용자 ICC 프로파일 파일이 필요합니다.' }, { status: 400 })
  }

  const MAX_SVG_BYTES = 5 * 1024 * 1024 // 5 MB
  if (files.some(file => !file.name.toLowerCase().endsWith('.svg'))) {
    return NextResponse.json({ error: 'SVG 파일만 업로드 가능합니다' }, { status: 400 })
  }
  if (files.some(file => file.size > MAX_SVG_BYTES)) {
    return NextResponse.json({ error: 'SVG 파일 크기는 5MB를 초과할 수 없습니다' }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), 'uploads')
  const svgDir = path.join(uploadDir, 'svg')
  const iccDir = path.join(uploadDir, 'icc')
  await mkdir(svgDir, { recursive: true })
  await mkdir(iccDir, { recursive: true })

  let customIccPath: string | null = null
  if (printColorProfileMode === 'custom-icc' && customIcc instanceof File) {
    const filename = makeSafeFilename(customIcc.name, files.length)
    customIccPath = path.join(iccDir, filename)
    await writeFile(customIccPath, Buffer.from(await customIcc.arrayBuffer()))
  }

  let preparedSheets: Awaited<typeof preparedSheetsPromise>
  const preparedSheetsPromise = Promise.all(files.map(async (file, index) => {
    const svgString = await file.text()
    if (!/<svg[\s>]/i.test(svgString)) {
      throw new Error(`'${file.name}'은 유효한 SVG 파일이 아닙니다.`)
    }
    const normalized = normalizeSVGForEditing(svgString)
    const dimensions = getSvgDimensions(normalized.normalizedSvg)
    const filename = makeSafeFilename(file.name, index)
    const svgPath = path.join(svgDir, filename)
    await writeFile(svgPath, normalized.normalizedSvg, 'utf-8')
    return {
      name: `대지 ${index + 1}`,
      order: index,
      svgPath,
      svgContent: normalized.normalizedSvg,
      fields: JSON.stringify(normalized.fields),
      width: dimensions.width,
      height: dimensions.height,
      unit: dimensions.unit,
      widthPx: dimensions.widthPx,
      heightPx: dimensions.heightPx,
      fieldCount: normalized.fields.length,
      generatedFieldCount: normalized.generatedFieldCount,
    }
  }))
  try {
    preparedSheets = await preparedSheetsPromise
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SVG 파일 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Detect fonts across all sheets and download missing ones
  const allFontFamilies = [...new Set(preparedSheets.flatMap(sheet => extractSVGFontFamilies(sheet.svgContent)))]
  const fontDownloadResults = await ensureFontsDownloaded(allFontFamilies).catch((err) => {
    console.warn('[templates] Font download failed, continuing without fonts:', err)
    return []
  })

  const firstSheet = preparedSheets[0]

  const template = await prisma.template.create({
    data: {
      name,
      category,
      svgPath: firstSheet.svgPath,
      fields: firstSheet.fields,
      printColorProfileMode,
      adobeWorkingCmykPreset: printColorProfileMode === 'adobe-working-cmyk' ? adobeWorkingCmykPreset : null,
      customIccPath,
      sheets: {
        create: preparedSheets.map(sheet => ({
          name: sheet.name,
          order: sheet.order,
          svgPath: sheet.svgPath,
          fields: sheet.fields,
          width: sheet.width,
          height: sheet.height,
          unit: sheet.unit,
          widthPx: sheet.widthPx,
          heightPx: sheet.heightPx,
        })),
      },
    },
    include: {
      sheets: {
        select: { id: true, name: true, order: true, svgPath: true, width: true, height: true, unit: true, widthPx: true, heightPx: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  return NextResponse.json({
    id: template.id,
    name: template.name,
    category: template.category,
    printSettings: {
      colorProfileMode: template.printColorProfileMode,
      adobeWorkingCmykPreset: template.adobeWorkingCmykPreset,
      customIccPath: template.customIccPath,
      sourceRgbIcc: template.sourceRgbIcc ?? null,
    },
    sheets: template.sheets.map((sheet, index) => ({
      ...sheet,
      width: preparedSheets[index]?.width ?? sheet.width ?? 0,
      height: preparedSheets[index]?.height ?? sheet.height ?? 0,
      unit: preparedSheets[index]?.unit ?? sheet.unit ?? 'px',
      widthPx: preparedSheets[index]?.widthPx ?? sheet.widthPx ?? 0,
      heightPx: preparedSheets[index]?.heightPx ?? sheet.heightPx ?? 0,
      fieldCount: preparedSheets[index]?.fieldCount ?? 0,
      generatedFieldCount: preparedSheets[index]?.generatedFieldCount ?? 0,
    })),
    fonts: fontDownloadResults.map(result => ({
      family: result.family,
      downloaded: result.downloaded.length,
      skipped: result.skipped.length,
      failed: result.failed,
      requiresManualUpload: result.requiresManualUpload,
    })),
  }, { status: 201 })
}
