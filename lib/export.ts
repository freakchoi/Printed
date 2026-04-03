import puppeteer from 'puppeteer'
import { exec } from 'child_process'
import { promisify } from 'util'
import { unlink, readFile, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import type { CombinedImageDirection, ImageSelectionMode, ProjectValuesBySheet, TemplatePrintSettings, TemplateSheetDetail } from '@/lib/template-model'
import { getSvgDimensions } from '@/lib/svg-dimensions'
import { applyFieldValuesToSVG } from '@/lib/svg-parser'
import { resolveTemplatePrintProfile } from '@/lib/print-color.server'

const execAsync = promisify(exec)
const MAX_RASTER_EDGE = 12000
export type PdfRenderStrategy = 'vector' | 'raster-fidelity'

export type RasterMode = 'default' | 'high-res'

export interface RenderableSheet {
  id: string
  name: string
  order: number
  svgString: string
}

export function getRasterScale(rasterMode: RasterMode = 'high-res') {
  return rasterMode === 'high-res' ? 4 : 1
}

export function getRasterExportDimensions(
  widthPx: number,
  heightPx: number,
  rasterMode: RasterMode = 'high-res',
) {
  const scale = getRasterScale(rasterMode)
  const baseWidth = Math.max(1, Math.ceil(widthPx * scale))
  const baseHeight = Math.max(1, Math.ceil(heightPx * scale))
  const longestEdge = Math.max(baseWidth, baseHeight)

  if (longestEdge <= MAX_RASTER_EDGE) {
    return { width: baseWidth, height: baseHeight, scale }
  }

  const clampRatio = MAX_RASTER_EDGE / longestEdge
  return {
    width: Math.max(1, Math.floor(baseWidth * clampRatio)),
    height: Math.max(1, Math.floor(baseHeight * clampRatio)),
    scale,
  }
}

export function buildExportSVG(svgString: string, values: ProjectValuesBySheet[string]) {
  return applyFieldValuesToSVG(svgString, values)
}

export function resolvePdfRenderStrategy(sheets: TemplateSheetDetail[]): PdfRenderStrategy {
  return sheets.some(sheet => (
    sheet.fields.some(field => Boolean(field.letterSpacing?.trim())) ||
    sheet.svgContent.includes('data-printed-letter-spacing=') ||
    sheet.svgContent.includes('letter-spacing=')
  ))
    ? 'raster-fidelity'
    : 'vector'
}

function mmToPt(value: number) {
  return value / 25.4 * 72
}

function cmToPt(value: number) {
  return value / 2.54 * 72
}

function inToPt(value: number) {
  return value * 72
}

function pxToPt(value: number) {
  return value * 72 / 96
}

function ptToIn(value: number) {
  return value / 72
}

type PdfPageSizeSpec = {
  widthPt: number
  heightPt: number
}

async function assertGhostscriptAvailable() {
  try {
    await execAsync('gs --version')
  } catch {
    throw new Error('PDF CMYK 내보내기를 사용하려면 Ghostscript 설치가 필요합니다.')
  }
}

export function getSheetPdfSizePt(sheet: Pick<TemplateSheetDetail, 'width' | 'height' | 'unit' | 'widthPx' | 'heightPx'>) {
  switch (sheet.unit) {
    case 'mm':
      return { widthPt: mmToPt(sheet.width), heightPt: mmToPt(sheet.height) }
    case 'cm':
      return { widthPt: cmToPt(sheet.width), heightPt: cmToPt(sheet.height) }
    case 'in':
      return { widthPt: inToPt(sheet.width), heightPt: inToPt(sheet.height) }
    case 'pt':
      return { widthPt: sheet.width, heightPt: sheet.height }
    case 'pc':
      return { widthPt: sheet.width * 12, heightPt: sheet.height * 12 }
    case 'px':
    default:
      return { widthPt: pxToPt(sheet.widthPx), heightPt: pxToPt(sheet.heightPx) }
  }
}

function formatCssPageDimension(value: number, unit: TemplateSheetDetail['unit']) {
  return `${value}${unit}`
}

export function buildExportHTMLForSheets(sheets: TemplateSheetDetail[], values: ProjectValuesBySheet) {
  const orderedSheets = [...sheets].sort((a, b) => a.order - b.order)
  const sizedSheets = orderedSheets.map((sheet, index) => {
    const sheetValues = values[sheet.id] ?? {}
    const svg = buildExportSVG(sheet.svgContent, sheetValues)
    const fallbackDimensions = (
      typeof sheet.widthPx === 'number' &&
      typeof sheet.heightPx === 'number' &&
      typeof sheet.width === 'number' &&
      typeof sheet.height === 'number' &&
      typeof sheet.unit === 'string'
    ) ? null : getSvgDimensions(svg)
    return {
      pageClass: `page-${index + 1}`,
      pageName: `sheet-${index + 1}`,
      svg,
      width: fallbackDimensions?.width ?? sheet.width,
      height: fallbackDimensions?.height ?? sheet.height,
      unit: fallbackDimensions?.unit ?? sheet.unit,
      widthPx: fallbackDimensions?.widthPx ?? sheet.widthPx,
      heightPx: fallbackDimensions?.heightPx ?? sheet.heightPx,
    }
  })

  const pageRules = sizedSheets
    .map(sheet => `@page ${sheet.pageName} { size: ${formatCssPageDimension(sheet.width, sheet.unit)} ${formatCssPageDimension(sheet.height, sheet.unit)}; margin: 0; }`)
    .join('\n')

  const pages = sizedSheets
    .map(sheet => {
      return `<section class="page ${sheet.pageClass}" data-page="${sheet.pageName}" style="width:${sheet.widthPx}px;height:${sheet.heightPx}px;"><div class="sheet-surface">${sheet.svg}</div></section>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
  <head>
    <style>
      ${pageRules}
      html, body {
        margin: 0;
        padding: 0;
        background: white;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }
      .page {
        display: flex;
        align-items: center;
        justify-content: center;
        page-break-after: always;
        overflow: hidden;
      }
      .page:last-child {
        page-break-after: auto;
      }
      ${sizedSheets
        .map(sheet => `.${sheet.pageClass} { page: ${sheet.pageName}; }`)
        .join('\n')}
      .sheet-surface {
        width: 100%;
        height: 100%;
        background: white;
      }
      .sheet-surface svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .sheet-surface svg text,
      .sheet-surface svg tspan {
        font-kerning: none;
        text-rendering: geometricPrecision;
      }
    </style>
  </head>
  <body>${pages}</body>
</html>`
}

export function buildExportHTMLForSheet(sheet: TemplateSheetDetail, values: ProjectValuesBySheet[string]) {
  const svg = buildExportSVG(sheet.svgContent, values)
  const widthPx = sheet.widthPx
  const heightPx = sheet.heightPx

  return `<!DOCTYPE html>
<html>
  <head>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: white;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }
      body {
        width: ${widthPx}px;
        height: ${heightPx}px;
        overflow: hidden;
      }
      .sheet-surface {
        width: ${widthPx}px;
        height: ${heightPx}px;
        background: white;
      }
      .sheet-surface svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .sheet-surface svg text,
      .sheet-surface svg tspan {
        font-kerning: none;
        text-rendering: geometricPrecision;
      }
    </style>
  </head>
  <body>
    <div class="sheet-surface">${svg}</div>
  </body>
</html>`
}

function getImageExtension(format: 'png' | 'jpeg') {
  return format === 'jpeg' ? 'jpg' : 'png'
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'sheet'
}

async function renderSvgSurface(svgString: string, width: number, height: number) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height })
    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fff;">
    <div id="export-surface" style="width:${width}px;height:${height}px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;">
      ${svgString}
    </div>
    <style>
      #export-surface svg {
        display:block;
        width:100%;
        height:100%;
      }
    </style>
  </body>
</html>`
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const element = await page.$('#export-surface')
    if (!element) throw new Error('Export surface not found in page')
    return await element.screenshot({ type: 'png' }) as Buffer
  } finally {
    await browser.close()
  }
}

async function encodeRasterBuffer(buffer: Buffer, format: 'png' | 'jpeg') {
  const image = sharp(buffer)
    .flatten({ background: '#ffffff' })
    .withMetadata({ density: 300 })

  return format === 'png'
    ? await image.png().toBuffer()
    : await image.jpeg({ quality: 92 }).toBuffer()
}

async function renderSvgToRaster(svgString: string, rasterMode: RasterMode = 'high-res') {
  const dimensions = getSvgDimensions(svgString)
  const target = getRasterExportDimensions(dimensions.widthPx, dimensions.heightPx, rasterMode)
  const pngBuffer = await renderSvgSurface(svgString, target.width, target.height)
  return {
    buffer: await sharp(pngBuffer).flatten({ background: '#ffffff' }).png().toBuffer(),
    width: target.width,
    height: target.height,
  }
}

export async function exportToImage(
  svgString: string,
  format: 'png' | 'jpeg' = 'png',
  options?: { rasterMode?: RasterMode },
): Promise<Buffer> {
  const raster = await renderSvgToRaster(svgString, options?.rasterMode ?? 'high-res')
  return encodeRasterBuffer(raster.buffer, format)
}

export function selectRenderableSheets<T extends { id: string; order: number }>(
  sheets: T[],
  options: {
    selectionMode?: ImageSelectionMode
    rangeStart?: number
    rangeEnd?: number
  },
) {
  const ordered = [...sheets].sort((a, b) => a.order - b.order)
  const selectionMode = options.selectionMode ?? 'all'

  if (selectionMode === 'all') {
    return ordered
  }

  if (selectionMode === 'range') {
    const start = Math.max(1, Math.min(options.rangeStart ?? 1, options.rangeEnd ?? 1))
    const end = Math.max(options.rangeStart ?? 1, options.rangeEnd ?? 1)
    return ordered.filter((_, index) => {
      const sequence = index + 1
      return sequence >= start && sequence <= end
    })
  }

  return ordered
}

export async function exportRenderableSheetsToCombinedImage(
  sheets: RenderableSheet[],
  format: 'png' | 'jpeg',
  options?: { rasterMode?: RasterMode; combinedDirection?: CombinedImageDirection },
) {
  const ordered = [...sheets].sort((a, b) => a.order - b.order)
  const rendered = await Promise.all(
    ordered.map(sheet => renderSvgToRaster(sheet.svgString, options?.rasterMode ?? 'high-res')),
  )

  const combinedDirection = options?.combinedDirection ?? 'horizontal'
  const width = combinedDirection === 'horizontal'
    ? rendered.reduce((sum, item) => sum + item.width, 0)
    : Math.max(...rendered.map(item => item.width), 1)
  const height = combinedDirection === 'horizontal'
    ? Math.max(...rendered.map(item => item.height), 1)
    : rendered.reduce((sum, item) => sum + item.height, 0)

  let offsetLeft = 0
  let offsetTop = 0
  const composite = rendered.map(item => {
    if (combinedDirection === 'horizontal') {
      const left = offsetLeft
      offsetLeft += item.width
      return {
        input: item.buffer,
        top: Math.floor((height - item.height) / 2),
        left,
      }
    }

    const top = offsetTop
    offsetTop += item.height
    return {
      input: item.buffer,
      top,
      left: Math.floor((width - item.width) / 2),
    }
  })

  const combined = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#ffffff',
    },
  }).composite(composite).png().toBuffer()

  return encodeRasterBuffer(combined, format)
}

export async function exportRenderableSheetsToSeparateArchive(
  sheets: RenderableSheet[],
  format: 'png' | 'jpeg',
  options?: { rasterMode?: RasterMode },
) {
  const ordered = [...sheets].sort((a, b) => a.order - b.order)
  const extension = getImageExtension(format)

  if (ordered.length === 1) {
    const [sheet] = ordered
    return {
      kind: 'single' as const,
      extension,
      contentType: format === 'png' ? 'image/png' : 'image/jpeg',
      fileName: `${String(sheet.order + 1).padStart(2, '0')}-${sanitizeFilenamePart(sheet.name)}.${extension}`,
      buffer: await exportToImage(sheet.svgString, format, options),
    }
  }

  const zip = new JSZip()
  for (const sheet of ordered) {
    const buffer = await exportToImage(sheet.svgString, format, options)
    zip.file(`${String(sheet.order + 1).padStart(2, '0')}-${sanitizeFilenamePart(sheet.name)}.${extension}`, buffer)
  }

  return {
    kind: 'zip' as const,
    extension: 'zip',
    contentType: 'application/zip',
    fileName: 'sheets.zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  }
}

async function mergePdfBuffers(buffers: Buffer[]) {
  const merged = await PDFDocument.create()
  for (const buffer of buffers) {
    const source = await PDFDocument.load(buffer)
    const pages = await merged.copyPages(source, source.getPageIndices())
    pages.forEach(page => merged.addPage(page))
  }
  return Buffer.from(await merged.save())
}

async function recomposePdfPagesToExactSize(pdfBuffer: Buffer, pageSizes: PdfPageSizeSpec[]) {
  const sourcePdf = await PDFDocument.load(new Uint8Array(pdfBuffer))
  const sourcePages = sourcePdf.getPages()

  if (sourcePages.length !== pageSizes.length) {
    throw new Error(`PDF 페이지 수가 예상과 다릅니다. expected=${pageSizes.length} actual=${sourcePages.length}`)
  }

  const targetPdf = await PDFDocument.create()

  for (const [index, sourcePage] of sourcePages.entries()) {
    const { widthPt, heightPt } = pageSizes[index]
    const cropBox = sourcePage.getCropBox()
    const mediaBox = sourcePage.getMediaBox()
    const sourceBox = cropBox.width > 0 && cropBox.height > 0 ? cropBox : mediaBox
    const embeddedPage = await targetPdf.embedPage(sourcePage, {
      left: sourceBox.x,
      bottom: sourceBox.y,
      right: sourceBox.x + sourceBox.width,
      top: sourceBox.y + sourceBox.height,
    })
    const page = targetPdf.addPage([widthPt, heightPt])

    // Align to the source artboard's top-left origin instead of shrinking boxes in place.
    page.drawPage(embeddedPage, {
      x: 0,
      y: heightPt - sourceBox.height,
      width: sourceBox.width,
      height: sourceBox.height,
    })
    page.setMediaBox(0, 0, widthPt, heightPt)
    page.setCropBox(0, 0, widthPt, heightPt)
    page.setBleedBox(0, 0, widthPt, heightPt)
    page.setTrimBox(0, 0, widthPt, heightPt)
    page.setArtBox(0, 0, widthPt, heightPt)
  }

  return Buffer.from(await targetPdf.save())
}

async function fixPdfPageBoxes(pdfBuffer: Buffer, pageSizes: PdfPageSizeSpec[]) {
  const pdf = await PDFDocument.load(new Uint8Array(pdfBuffer))
  const pages = pdf.getPages()

  if (pages.length !== pageSizes.length) {
    throw new Error(`PDF 페이지 수가 예상과 다릅니다. expected=${pageSizes.length} actual=${pages.length}`)
  }

  pages.forEach((page, index) => {
    const { widthPt, heightPt } = pageSizes[index]
    page.setSize(widthPt, heightPt)
    page.setMediaBox(0, 0, widthPt, heightPt)
    page.setCropBox(0, 0, widthPt, heightPt)
    page.setBleedBox(0, 0, widthPt, heightPt)
    page.setTrimBox(0, 0, widthPt, heightPt)
    page.setArtBox(0, 0, widthPt, heightPt)
  })

  return Buffer.from(await pdf.save())
}

async function exportRgbPdf(html: string, options: { widthPx: number; heightPx: number; widthPt: number; heightPt: number }) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: Math.max(1, Math.ceil(options.widthPx)), height: Math.max(1, Math.ceil(options.heightPx)) })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      width: `${ptToIn(options.widthPt).toFixed(6)}in`,
      height: `${ptToIn(options.heightPt).toFixed(6)}in`,
      printBackground: true,
      preferCSSPageSize: false,
      pageRanges: '1',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

async function exportRgbMultiPagePdf(html: string) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

async function exportRasterizedPdfPages(
  sheets: TemplateSheetDetail[],
  values: ProjectValuesBySheet,
): Promise<Buffer> {
  const orderedSheets = [...sheets].sort((a, b) => a.order - b.order)
  const pdf = await PDFDocument.create()

  for (const sheet of orderedSheets) {
    const svg = buildExportSVG(sheet.svgContent, values[sheet.id] ?? {})
    const raster = await renderSvgToRaster(svg, 'high-res')
    const pageImage = await pdf.embedPng(raster.buffer)
    const { widthPt, heightPt } = getSheetPdfSizePt(sheet)
    const page = pdf.addPage([widthPt, heightPt])
    page.drawImage(pageImage, {
      x: 0,
      y: 0,
      width: widthPt,
      height: heightPt,
    })
    page.setMediaBox(0, 0, widthPt, heightPt)
    page.setCropBox(0, 0, widthPt, heightPt)
    page.setBleedBox(0, 0, widthPt, heightPt)
    page.setTrimBox(0, 0, widthPt, heightPt)
    page.setArtBox(0, 0, widthPt, heightPt)
  }

  return Buffer.from(await pdf.save())
}

export async function exportSheetsToPDF(
  sheets: TemplateSheetDetail[],
  values: ProjectValuesBySheet,
  printSettings: TemplatePrintSettings | null | undefined,
): Promise<Buffer> {
  const orderedSheets = [...sheets].sort((a, b) => a.order - b.order)
  const pageSizes = orderedSheets.map(sheet => getSheetPdfSizePt(sheet))
  await assertGhostscriptAvailable()
  const printProfile = await resolveTemplatePrintProfile(printSettings)
  const renderStrategy = resolvePdfRenderStrategy(orderedSheets)
  if (renderStrategy === 'raster-fidelity') {
    try {
      const rasterPdf = await exportRasterizedPdfPages(orderedSheets, values)
      const cmykPdf = await exportPdfToManagedCmyk(rasterPdf, printProfile)
      return fixPdfPageBoxes(cmykPdf, pageSizes)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      throw new Error(`PDF 출력 렌더링 중 오류가 발생했습니다. 자간 보정용 고해상도 렌더링을 완료하지 못했습니다: ${message}`)
    }
  }

  try {
    const pdfPages = await Promise.all(
      orderedSheets.map(async (sheet) => {
        const html = buildExportHTMLForSheet(sheet, values[sheet.id] ?? {})
        const { widthPt, heightPt } = getSheetPdfSizePt(sheet)
        return exportRgbPdf(html, {
          widthPx: sheet.widthPx,
          heightPx: sheet.heightPx,
          widthPt,
          heightPt,
        })
      }),
    )

    const mergedPdf = await mergePdfBuffers(pdfPages)
    const recomposedPdf = await recomposePdfPagesToExactSize(mergedPdf, pageSizes)
    const cmykPdf = await exportPdfToManagedCmyk(recomposedPdf, printProfile)
    return fixPdfPageBoxes(cmykPdf, pageSizes)
  } catch (error) {
    console.warn('Falling back to CSS page-size PDF export.', error)
    const fallbackPdf = await exportRgbMultiPagePdf(buildExportHTMLForSheets(orderedSheets, values))
    const recomposedPdf = await recomposePdfPagesToExactSize(fallbackPdf, pageSizes)
    const cmykPdf = await exportPdfToManagedCmyk(recomposedPdf, printProfile)
    return fixPdfPageBoxes(cmykPdf, pageSizes)
  }
}

async function exportPdfToManagedCmyk(
  rgbPdfBuffer: Buffer,
  profile: Awaited<ReturnType<typeof resolveTemplatePrintProfile>>,
): Promise<Buffer> {
  const exportDir = path.join(process.cwd(), 'exports')
  await mkdir(exportDir, { recursive: true })

  const tmpId = Date.now()
  const rgbPath = path.join(exportDir, `${tmpId}_rgb.pdf`)
  const cmykPath = path.join(exportDir, `${tmpId}_cmyk.pdf`)

  await writeBuffer(rgbPath, rgbPdfBuffer)

  try {
    const permitReadFlags = [
      `--permit-file-read="${profile.sourceRgbIccPath}"`,
      `--permit-file-read="${profile.outputIccPath}"`,
    ].join(' ')
    await execAsync(
      `gs -dSAFER ${permitReadFlags} -dBATCH -dNOPAUSE ` +
      `-sDEVICE=pdfwrite ` +
      `-dOverrideICC ` +
      `-sDefaultRGBProfile="${profile.sourceRgbIccPath}" ` +
      `-sOutputICCProfile="${profile.outputIccPath}" ` +
      `-sColorConversionStrategy=CMYK ` +
      `-dProcessColorModel=/DeviceCMYK ` +
      `-sOutputFile="${cmykPath}" "${rgbPath}"`
    )
    return await readFile(cmykPath)
  } catch (error) {
    console.error('Ghostscript CMYK conversion failed.', error)
    throw new Error(`CMYK PDF 변환에 실패했습니다. 프로파일 설정을 확인하세요: ${profile.label}`)
  } finally {
    await unlink(rgbPath).catch(() => {})
    await unlink(cmykPath).catch(() => {})
  }
}

async function writeBuffer(filePath: string, buffer: Buffer) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)
}

export { fixPdfPageBoxes, recomposePdfPagesToExactSize }
