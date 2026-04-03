import { access, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import https from 'https'
import http from 'http'

export interface FontDownloadResult {
  family: string
  downloaded: string[]
  skipped: string[]
  failed: string[]
  requiresManualUpload: boolean
}

interface FontVariant {
  weight: string
  filename: string
  url: string
}

type KnownFontFamily = 'Pretendard' | 'Pretendard JP'

const PRETENDARD_BASE = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static'
const PRETENDARD_JP_BASE = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard-jp/dist/public/static'

const FONT_REGISTRY: Record<KnownFontFamily, FontVariant[]> = {
  'Pretendard': [
    { weight: '100', filename: 'Pretendard-Thin.otf', url: `${PRETENDARD_BASE}/Pretendard-Thin.otf` },
    { weight: '200', filename: 'Pretendard-ExtraLight.otf', url: `${PRETENDARD_BASE}/Pretendard-ExtraLight.otf` },
    { weight: '300', filename: 'Pretendard-Light.otf', url: `${PRETENDARD_BASE}/Pretendard-Light.otf` },
    { weight: '400', filename: 'Pretendard-Regular.otf', url: `${PRETENDARD_BASE}/Pretendard-Regular.otf` },
    { weight: '500', filename: 'Pretendard-Medium.otf', url: `${PRETENDARD_BASE}/Pretendard-Medium.otf` },
    { weight: '600', filename: 'Pretendard-SemiBold.otf', url: `${PRETENDARD_BASE}/Pretendard-SemiBold.otf` },
    { weight: '700', filename: 'Pretendard-Bold.otf', url: `${PRETENDARD_BASE}/Pretendard-Bold.otf` },
    { weight: '800', filename: 'Pretendard-ExtraBold.otf', url: `${PRETENDARD_BASE}/Pretendard-ExtraBold.otf` },
    { weight: '900', filename: 'Pretendard-Black.otf', url: `${PRETENDARD_BASE}/Pretendard-Black.otf` },
  ],
  'Pretendard JP': [
    { weight: '100', filename: 'PretendardJP-Thin.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-Thin.otf` },
    { weight: '200', filename: 'PretendardJP-ExtraLight.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-ExtraLight.otf` },
    { weight: '300', filename: 'PretendardJP-Light.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-Light.otf` },
    { weight: '400', filename: 'PretendardJP-Regular.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-Regular.otf` },
    { weight: '500', filename: 'PretendardJP-Medium.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-Medium.otf` },
    { weight: '600', filename: 'PretendardJP-SemiBold.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-SemiBold.otf` },
    { weight: '700', filename: 'PretendardJP-Bold.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-Bold.otf` },
    { weight: '800', filename: 'PretendardJP-ExtraBold.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-ExtraBold.otf` },
    { weight: '900', filename: 'PretendardJP-Black.otf', url: `${PRETENDARD_JP_BASE}/PretendardJP-Black.otf` },
  ],
}

// Fonts that must be uploaded manually (no public CDN source)
const MANUAL_UPLOAD_FAMILIES = new Set([
  'Gmarket Sans',
  'Gmarket Sans TTF',
  'Noto Sans JP',
  'AppleMyungjo',
])

function isKnownFont(family: string): family is KnownFontFamily {
  return family in FONT_REGISTRY
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const location = response.headers.location
        if (!location) return reject(new Error(`Redirect without location: ${url}`))
        return downloadFile(location, destPath).then(resolve).catch(reject)
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}: ${url}`))
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', async () => {
        try {
          await writeFile(destPath, Buffer.concat(chunks))
          resolve()
        } catch (err) {
          reject(err)
        }
      })
      response.on('error', reject)
    })
    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error(`Timeout downloading: ${url}`))
    })
  })
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export async function ensureFontsDownloaded(families: string[]): Promise<FontDownloadResult[]> {
  const fontDir = path.join(process.cwd(), 'public', 'fonts')
  await mkdir(fontDir, { recursive: true })

  const results: FontDownloadResult[] = []

  for (const family of families) {
    if (MANUAL_UPLOAD_FAMILIES.has(family)) {
      results.push({ family, downloaded: [], skipped: [], failed: [], requiresManualUpload: true })
      continue
    }

    if (!isKnownFont(family)) {
      results.push({ family, downloaded: [], skipped: [], failed: [], requiresManualUpload: true })
      continue
    }

    const variants = FONT_REGISTRY[family]
    const downloaded: string[] = []
    const skipped: string[] = []
    const failed: string[] = []

    await Promise.all(
      variants.map(async (variant) => {
        const destPath = path.join(fontDir, variant.filename)
        if (await fileExists(destPath)) {
          skipped.push(variant.filename)
          return
        }
        try {
          await downloadFile(variant.url, destPath)
          downloaded.push(variant.filename)
        } catch (err) {
          console.warn(`[font-downloader] Failed to download ${variant.filename}:`, err)
          failed.push(variant.filename)
        }
      }),
    )

    results.push({ family, downloaded, skipped, failed, requiresManualUpload: false })
  }

  return results
}
