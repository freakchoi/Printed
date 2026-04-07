import puppeteer from 'puppeteer'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { unlink, readFile, mkdir, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import JSZip from 'jszip'
import pLimit from 'p-limit'
import { PDFDocument } from 'pdf-lib'
import type { CombinedImageDirection, ImageSelectionMode, ProjectValuesBySheet, TemplatePrintSettings, TemplateSheetDetail } from '@/lib/template-model'
import { getSvgDimensions } from '@/lib/svg-dimensions'
import { applyFieldValuesToSVG } from '@/lib/svg-parser'
import { resolveTemplatePrintProfile } from '@/lib/print-color.server'
import { FONT_REGISTRY } from '@/lib/fonts'

const execFileAsync = promisify(execFile)

// 동시 PDF export를 직렬화해 Puppeteer 브라우저 싱글턴 경쟁 방지
const exportLimiter = pLimit(1)

let _browser: import('puppeteer').Browser | null = null

async function getBrowser() {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  }
  return _browser
}

const MAX_RASTER_EDGE = 12000
const PRINTED_PDF_CREATOR = 'Printed'
const PRINTED_PDF_PRODUCER = 'Printed PDF Engine'
const PDF_COMPATIBILITY_LEVEL = '1.6'
export type PdfRenderStrategy = 'vector' | 'raster-fidelity'
type PdfRenderReason = 'default-vector' | 'unsupported-svg-effect'

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

function buildFontFaceCSS(): string {
  const fontDir = path.join(process.cwd(), 'public', 'fonts')
  return FONT_REGISTRY
    .flatMap(({ file, family, weight, psAlias }) => {
      const src = `url('file://${path.join(fontDir, file)}')`
      const rules = [
        `@font-face { font-family: '${family}'; src: ${src}; font-weight: ${weight}; font-style: normal; }`,
      ]
      if (psAlias) {
        rules.push(`@font-face { font-family: '${psAlias}'; src: ${src}; font-weight: 400; font-style: normal; }`)
      }
      return rules
    })
    .join('\n')
}

function resolvePdfRenderDecision(sheets: TemplateSheetDetail[]): { strategy: PdfRenderStrategy; reason: PdfRenderReason } {
  const rasterFallbackTokens = [
    '<filter',
    '<mask',
    ' mask=',
    '<foreignObject',
    'mix-blend-mode:',
  ]

  const requiresRasterFallback = sheets.some(sheet => (
    rasterFallbackTokens.some(token => sheet.svgContent.includes(token))
  ))

  if (requiresRasterFallback) {
    return { strategy: 'raster-fidelity', reason: 'unsupported-svg-effect' }
  }

  return { strategy: 'vector', reason: 'default-vector' }
}

export function resolvePdfRenderStrategy(sheets: TemplateSheetDetail[]): PdfRenderStrategy {
  return resolvePdfRenderDecision(sheets).strategy
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

function roundPdfPoint(value: number) {
  return Number(value.toFixed(3))
}

type PdfPageSizeSpec = {
  widthPt: number
  heightPt: number
}

type PrintedPdfMetadata = {
  title?: string
}


async function assertGhostscriptAvailable() {
  try {
    await execFileAsync('gs', ['--version'])
  } catch {
    throw new Error('PDF CMYK 내보내기를 사용하려면 Ghostscript 설치가 필요합니다.')
  }
}

export function getSheetPdfSizePt(sheet: Pick<TemplateSheetDetail, 'width' | 'height' | 'unit' | 'widthPx' | 'heightPx'>) {
  switch (sheet.unit) {
    case 'mm':
      return { widthPt: roundPdfPoint(mmToPt(sheet.width)), heightPt: roundPdfPoint(mmToPt(sheet.height)) }
    case 'cm':
      return { widthPt: roundPdfPoint(cmToPt(sheet.width)), heightPt: roundPdfPoint(cmToPt(sheet.height)) }
    case 'in':
      return { widthPt: roundPdfPoint(inToPt(sheet.width)), heightPt: roundPdfPoint(inToPt(sheet.height)) }
    case 'pt':
      return { widthPt: roundPdfPoint(sheet.width), heightPt: roundPdfPoint(sheet.height) }
    case 'pc':
      return { widthPt: roundPdfPoint(sheet.width * 12), heightPt: roundPdfPoint(sheet.height * 12) }
    case 'px':
    default:
      return { widthPt: roundPdfPoint(pxToPt(sheet.widthPx)), heightPt: roundPdfPoint(pxToPt(sheet.heightPx)) }
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
      ${buildFontFaceCSS()}
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
      ${buildFontFaceCSS()}
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
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
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
    await page.close()
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
  return exportLimiter(() => _exportToImageInternal(svgString, format, options))
}

async function _exportToImageInternal(
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
    const source = await PDFDocument.load(buffer, { updateMetadata: false })
    const pages = await merged.copyPages(source, source.getPageIndices())
    pages.forEach(page => merged.addPage(page))
  }
  return Buffer.from(await merged.save())
}

async function recomposePdfPagesToExactSize(pdfBuffer: Buffer, pageSizes: PdfPageSizeSpec[]) {
  const sourcePdf = await PDFDocument.load(new Uint8Array(pdfBuffer), { updateMetadata: false })
  const sourcePages = sourcePdf.getPages()

  if (sourcePages.length !== pageSizes.length) {
    throw new Error(`PDF 페이지 수가 예상과 다릅니다. expected=${pageSizes.length} actual=${sourcePages.length}`)
  }

  const targetPdf = await PDFDocument.create()

  for (const [index, sourcePage] of sourcePages.entries()) {
    const widthPt = roundPdfPoint(pageSizes[index].widthPt)
    const heightPt = roundPdfPoint(pageSizes[index].heightPt)
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

function applyPrintedPdfMetadata(pdf: PDFDocument, metadata?: PrintedPdfMetadata) {
  const title = metadata?.title?.trim()
  if (title) {
    pdf.setTitle(title)
  }
  pdf.setCreator(PRINTED_PDF_CREATOR)
  pdf.setProducer(PRINTED_PDF_PRODUCER)
}

async function fixPdfPageBoxes(
  pdfBuffer: Buffer,
  pageSizes: PdfPageSizeSpec[],
  metadata?: PrintedPdfMetadata,
) {
  const pdf = await PDFDocument.load(new Uint8Array(pdfBuffer), { updateMetadata: false })
  const pages = pdf.getPages()

  if (pages.length !== pageSizes.length) {
    throw new Error(`PDF 페이지 수가 예상과 다릅니다. expected=${pageSizes.length} actual=${pages.length}`)
  }

  pages.forEach((page, index) => {
    const widthPt = roundPdfPoint(pageSizes[index].widthPt)
    const heightPt = roundPdfPoint(pageSizes[index].heightPt)
    page.setSize(widthPt, heightPt)
    page.setMediaBox(0, 0, widthPt, heightPt)
    page.setCropBox(0, 0, widthPt, heightPt)
    page.setBleedBox(0, 0, widthPt, heightPt)
    page.setTrimBox(0, 0, widthPt, heightPt)
    page.setArtBox(0, 0, widthPt, heightPt)
  })

  applyPrintedPdfMetadata(pdf, metadata)
  return Buffer.from(await pdf.save())
}

async function exportRgbPdf(html: string, options: { widthPx: number; heightPx: number; widthPt: number; heightPt: number }) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: Math.max(1, Math.ceil(options.widthPx)), height: Math.max(1, Math.ceil(options.heightPx)) })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.evaluate(() => document.fonts.ready)
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
    await page.close()
  }
}

async function exportRgbMultiPagePdf(html: string) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.evaluate(() => document.fonts.ready)
    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await page.close()
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
  documentTitle?: string,
  options?: { outlineText?: boolean },
): Promise<Buffer> {
  return exportLimiter(() => _exportSheetsToPDFInternal(sheets, values, printSettings, documentTitle, options))
}

async function _exportSheetsToPDFInternal(
  sheets: TemplateSheetDetail[],
  values: ProjectValuesBySheet,
  printSettings: TemplatePrintSettings | null | undefined,
  documentTitle?: string,
  options?: { outlineText?: boolean },
): Promise<Buffer> {
  const orderedSheets = [...sheets].sort((a, b) => a.order - b.order)
  const pageSizes = orderedSheets.map(sheet => getSheetPdfSizePt(sheet))
  await assertGhostscriptAvailable()
  const printProfile = await resolveTemplatePrintProfile(printSettings)
  const renderDecision = resolvePdfRenderDecision(orderedSheets)
  console.info('[export] PDF render strategy', renderDecision)

  if (renderDecision.strategy === 'raster-fidelity') {
    try {
      const rasterPdf = await exportRasterizedPdfPages(orderedSheets, values)
      const cmykPdf = await exportPdfToManagedCmyk(rasterPdf, printProfile, options)
      return fixPdfPageBoxes(cmykPdf, pageSizes, { title: documentTitle })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      throw new Error(`PDF 출력 렌더링 중 오류가 발생했습니다. 래스터 fallback(${renderDecision.reason})을 완료하지 못했습니다: ${message}`)
    }
  }

  try {
    const pdfPages: Buffer[] = []
    for (const sheet of orderedSheets) {
      const html = buildExportHTMLForSheet(sheet, values[sheet.id] ?? {})
      const { widthPt, heightPt } = getSheetPdfSizePt(sheet)
      const pdfBuffer = await exportRgbPdf(html, {
        widthPx: sheet.widthPx,
        heightPx: sheet.heightPx,
        widthPt,
        heightPt,
      })
      pdfPages.push(pdfBuffer)
    }

    const mergedPdf = await mergePdfBuffers(pdfPages)
    const recomposedPdf = await recomposePdfPagesToExactSize(mergedPdf, pageSizes)
    const cmykPdf = await exportPdfToManagedCmyk(recomposedPdf, printProfile, options)
    return fixPdfPageBoxes(cmykPdf, pageSizes, { title: documentTitle })
  } catch (error) {
    console.warn('Falling back to CSS page-size PDF export.', { error, reason: renderDecision.reason })
    const fallbackPdf = await exportRgbMultiPagePdf(buildExportHTMLForSheets(orderedSheets, values))
    const recomposedPdf = await recomposePdfPagesToExactSize(fallbackPdf, pageSizes)
    const cmykPdf = await exportPdfToManagedCmyk(recomposedPdf, printProfile, options)
    return fixPdfPageBoxes(cmykPdf, pageSizes, { title: documentTitle })
  }
}

async function exportPdfToManagedCmyk(
  rgbPdfBuffer: Buffer,
  profile: Awaited<ReturnType<typeof resolveTemplatePrintProfile>>,
  options?: { outlineText?: boolean },
): Promise<Buffer> {
  const exportDir = path.join(os.tmpdir(), 'printed-export')
  await mkdir(exportDir, { recursive: true })

  const tmpId = crypto.randomUUID()
  const rgbPath = path.join(exportDir, `${tmpId}_rgb.pdf`)
  const cmykPath = path.join(exportDir, `${tmpId}_cmyk.pdf`)

  await writeBuffer(rgbPath, rgbPdfBuffer)

  try {
    await execFileAsync('gs', [
      '-dSAFER',
      `--permit-file-read=${profile.sourceRgbIccPath}`,
      `--permit-file-read=${profile.outputIccPath}`,
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=pdfwrite',
      `-dCompatibilityLevel=${PDF_COMPATIBILITY_LEVEL}`,
      '-dOverrideICC',
      `-sDefaultRGBProfile=${profile.sourceRgbIccPath}`,
      `-sOutputICCProfile=${profile.outputIccPath}`,
      '-sColorConversionStrategy=CMYK',
      '-dRenderingIntent=1',
      '-dBlackPointCompensation=true',
      '-dDeviceGrayToK=true',
      '-dAutoFilterColorImages=false',
      '-dColorImageFilter=/FlateEncode',
      '-dAutoFilterGrayImages=false',
      '-dGrayImageFilter=/FlateEncode',
      '-dDownsampleColorImages=false',
      '-dDownsampleGrayImages=false',
      '-dOverprint=/simulate',
      ...(options?.outlineText ? ['-dNoOutputFonts'] : []),
      `-sOutputFile=${cmykPath}`,
      rgbPath,
    ], { timeout: 60_000 })
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
