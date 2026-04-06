import 'dotenv/config'

import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '../lib/prisma'
import { getSvgDimensions } from '../lib/svg-dimensions'
import { normalizeSVGForEditing } from '../lib/svg-parser'

const SVG_DIR = path.join(process.cwd(), 'uploads', 'svg')
const DEFAULT_CATEGORY = '가져오기'

// "{timestamp}-{index}-{safeName}.svg" → { timestamp, index, safeName }
function parseFilename(filename: string) {
  const match = filename.match(/^(\d+)-(\d+)-(.+)\.svg$/)
  if (!match) return null
  return { timestamp: match[1], index: parseInt(match[2], 10), safeName: match[3] }
}

function deriveTemplateName(safeName: string) {
  return safeName.replace(/[_]+/g, ' ').trim() || '이름 없음'
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  // 현재 DB에 등록된 svgPath 목록
  const registeredPaths = new Set<string>()
  const sheets = await prisma.templateSheet.findMany({ select: { svgPath: true } })
  sheets.forEach(s => registeredPaths.add(s.svgPath))

  // 레거시 템플릿의 svgPath도 포함
  const legacyTemplates = await prisma.template.findMany({
    where: { sheets: { none: {} } },
    select: { svgPath: true },
  })
  legacyTemplates.forEach(t => registeredPaths.add(t.svgPath))

  // 폴더 내 전체 SVG 파일
  const allFiles = (await readdir(SVG_DIR))
    .filter(f => f.endsWith('.svg'))
    .map(f => ({ filename: f, fullPath: path.join(SVG_DIR, f), parsed: parseFilename(f) }))
    .filter(f => f.parsed !== null)

  // 미등록 파일만 필터
  const orphans = allFiles.filter(f => !registeredPaths.has(f.fullPath))

  if (orphans.length === 0) {
    console.log('고아 SVG 파일 없음. 모두 등록되어 있습니다.')
    return
  }

  console.log(`고아 파일 ${orphans.length}개 발견`)

  // timestamp 오름차순 정렬 후, index가 0으로 리셋될 때 새 그룹 시작
  const sortedOrphans = orphans.sort((a, b) =>
    a.parsed!.timestamp.localeCompare(b.parsed!.timestamp) ||
    a.parsed!.index - b.parsed!.index
  )

  const rawGroups: (typeof orphans)[] = []
  for (const orphan of sortedOrphans) {
    if (orphan.parsed!.index === 0 || rawGroups.length === 0) {
      rawGroups.push([orphan])
    } else {
      rawGroups[rawGroups.length - 1].push(orphan)
    }
  }

  const sortedGroups: [string, typeof orphans][] = rawGroups.map((files, i) => [
    files[0].parsed!.timestamp,
    files,
  ])

  let createdCount = 0
  for (const [timestamp, files] of sortedGroups) {
    const sorted = files.sort((a, b) => a.parsed!.index - b.parsed!.index)
    const firstName = sorted[0].parsed!.safeName
    const templateName = deriveTemplateName(firstName)

    console.log(`\n[${timestamp}] "${templateName}" — ${sorted.length}개 시트`)

    const sheetData = await Promise.all(sorted.map(async (file, i) => {
      const svgContent = await readFile(file.fullPath, 'utf-8')
      const normalized = normalizeSVGForEditing(svgContent)
      const dimensions = getSvgDimensions(normalized.normalizedSvg)
      console.log(`  대지 ${i + 1}: ${file.filename} (${dimensions.width}×${dimensions.height}${dimensions.unit}, 필드 ${normalized.fields.length}개)`)
      return {
        name: `대지 ${i + 1}`,
        order: i,
        svgPath: file.fullPath,
        fields: JSON.stringify(normalized.fields),
        width: dimensions.width,
        height: dimensions.height,
        unit: dimensions.unit,
        widthPx: dimensions.widthPx,
        heightPx: dimensions.heightPx,
      }
    }))

    if (!dryRun) {
      const first = sheetData[0]
      await prisma.template.create({
        data: {
          name: templateName,
          category: DEFAULT_CATEGORY,
          svgPath: first.svgPath,
          fields: first.fields,
          printColorProfileMode: 'adobe-working-cmyk',
          adobeWorkingCmykPreset: 'FOGRA39',
          sheets: { create: sheetData },
        },
      })
    }

    createdCount++
  }

  console.log(`\n${dryRun ? '[dry-run] ' : ''}템플릿 ${createdCount}개 ${dryRun ? '등록 예정' : '등록 완료'}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
