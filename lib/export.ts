import puppeteer from 'puppeteer'
import { exec } from 'child_process'
import { promisify } from 'util'
import { unlink, readFile, mkdir } from 'fs/promises'
import path from 'path'
import { applyValuesToSVG } from '@/lib/svg-parser'

const execAsync = promisify(exec)

export function buildExportSVG(svgString: string, values: Record<string, string>): string {
  return applyValuesToSVG(svgString, values)
}

// PNG/JPG → RGB (화면/웹용, Ghostscript 없음)
export async function exportToImage(svgString: string, format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;">${svgString}</body></html>`
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const element = await page.$('svg')
    if (!element) throw new Error('SVG element not found in page')
    const screenshot = await element.screenshot({ type: format })
    return screenshot as Buffer
  } finally {
    await browser.close()
  }
}

// PDF → CMYK (인쇄소 납품용, Ghostscript 변환)
export async function exportToPDF(svgString: string): Promise<Buffer> {
  const exportDir = path.join(process.cwd(), 'exports')
  await mkdir(exportDir, { recursive: true })

  const tmpId = Date.now()
  const rgbPath = path.join(exportDir, `${tmpId}_rgb.pdf`)
  const cmykPath = path.join(exportDir, `${tmpId}_cmyk.pdf`)

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;">${svgString}</body></html>`
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.pdf({ path: rgbPath, printBackground: true })
  } finally {
    await browser.close()
  }

  // Ghostscript: RGB PDF → CMYK PDF
  await execAsync(
    `gs -dSAFER -dBATCH -dNOPAUSE ` +
    `-sDEVICE=pdfwrite ` +
    `-sColorConversionStrategy=CMYK ` +
    `-dProcessColorModel=/DeviceCMYK ` +
    `-sOutputFile="${cmykPath}" "${rgbPath}"`
  )

  const buffer = await readFile(cmykPath)
  await unlink(rgbPath).catch(() => {})
  await unlink(cmykPath).catch(() => {})
  return buffer
}
