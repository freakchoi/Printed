import { readFile } from 'fs/promises'
import type { Template, TemplateSheet } from '@prisma/client'
import { getLegacySheetId, type ProjectSheetSnapshot, type TemplateDetail, type TemplateField, type TemplateListItem, type TemplatePrintSettings, type TemplateSheetDetail, type TemplateSheetSummary } from '@/lib/template-model'
import { getSvgDimensions } from '@/lib/svg-dimensions'
import { normalizeSVGForEditing } from '@/lib/svg-parser'

type StoredSheetDimensions = {
  width: number | null
  height: number | null
  unit: string | null
  widthPx: number | null
  heightPx: number | null
}

function parseStoredFields(fields: string): TemplateField[] {
  try {
    const parsed = JSON.parse(fields)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mergeHydratedFields(storedFields: TemplateField[], normalizedFields: TemplateField[]) {
  if (storedFields.length === 0) {
    return normalizedFields
  }

  const normalizedById = new Map(normalizedFields.map(field => [field.id, field]))
  return storedFields.map((field, index) => {
    const normalizedField = normalizedById.get(field.id) ?? normalizedFields[index]
    if (!normalizedField) return field
    return {
      ...field,
      textFrame: normalizedField.textFrame ?? field.textFrame ?? null,
      letterSpacing: field.letterSpacing ?? normalizedField.letterSpacing ?? null,
      alignment: field.alignment ?? normalizedField.alignment,
      wrapMode: field.wrapMode ?? normalizedField.wrapMode,
      sourceType: field.sourceType ?? normalizedField.sourceType,
      label: field.label ?? normalizedField.label,
      defaultValue: field.defaultValue ?? normalizedField.defaultValue,
      order: typeof field.order === 'number' ? field.order : normalizedField.order,
    }
  })
}

export function hydrateSheetSvgAndFields(svgContent: string, storedFields: TemplateField[]) {
  const normalized = normalizeSVGForEditing(svgContent)
  return {
    svgContent: normalized.normalizedSvg,
    fields: mergeHydratedFields(storedFields, normalized.fields),
  }
}

export function hydrateProjectSheetSnapshots(sheets: ProjectSheetSnapshot[]): ProjectSheetSnapshot[] {
  return sheets.map((sheet) => {
    const hydrated = hydrateSheetSvgAndFields(sheet.svgContent, sheet.fields)
    return hydrated.svgContent === sheet.svgContent && hydrated.fields === sheet.fields
      ? sheet
      : { ...sheet, svgContent: hydrated.svgContent, fields: hydrated.fields }
  })
}

function buildSheetDimensions(sheet: StoredSheetDimensions, svgContent?: string) {
  if (
    typeof sheet.width === 'number' &&
    typeof sheet.height === 'number' &&
    typeof sheet.widthPx === 'number' &&
    typeof sheet.heightPx === 'number' &&
    typeof sheet.unit === 'string'
  ) {
    return {
      width: sheet.width,
      height: sheet.height,
      unit: sheet.unit as TemplateSheetSummary['unit'],
      widthPx: sheet.widthPx,
      heightPx: sheet.heightPx,
    }
  }

  const fallback = getSvgDimensions(svgContent ?? '')
  return {
    width: fallback.width,
    height: fallback.height,
    unit: fallback.unit,
    widthPx: fallback.widthPx,
    heightPx: fallback.heightPx,
  }
}

function buildTemplatePrintSettings(template: {
  printColorProfileMode: string | null
  adobeWorkingCmykPreset: string | null
  customIccPath: string | null
  sourceRgbIcc?: string | null
}): TemplatePrintSettings {
  return {
    colorProfileMode: template.printColorProfileMode as TemplatePrintSettings['colorProfileMode'],
    adobeWorkingCmykPreset: template.adobeWorkingCmykPreset as TemplatePrintSettings['adobeWorkingCmykPreset'],
    customIccPath: template.customIccPath,
    sourceRgbIcc: template.sourceRgbIcc as TemplatePrintSettings['sourceRgbIcc'] ?? null,
  }
}

export async function buildSheetSummary(
  sheet: Pick<TemplateSheet, 'id' | 'name' | 'order' | 'width' | 'height' | 'unit' | 'widthPx' | 'heightPx' | 'svgPath'>,
): Promise<TemplateSheetSummary> {
  const dimensions = (
    typeof sheet.width === 'number' &&
    typeof sheet.height === 'number' &&
    typeof sheet.widthPx === 'number' &&
    typeof sheet.heightPx === 'number' &&
    typeof sheet.unit === 'string'
  )
    ? buildSheetDimensions(sheet)
    : buildSheetDimensions(
        { width: null, height: null, unit: null, widthPx: null, heightPx: null },
        await readFile(sheet.svgPath, 'utf-8'),
      )

  return {
    id: sheet.id,
    name: sheet.name,
    order: sheet.order,
    ...dimensions,
  }
}

export async function buildLegacySheetSummary(template: Pick<Template, 'id' | 'svgPath'>): Promise<TemplateSheetSummary> {
  const svgContent = await readFile(template.svgPath, 'utf-8')
  return {
    id: getLegacySheetId(template.id),
    name: '대지 1',
    order: 0,
    ...buildSheetDimensions({ width: null, height: null, unit: null, widthPx: null, heightPx: null }, svgContent),
  }
}

const templateDetailCache = new Map<string, { detail: TemplateDetail; timestamp: number }>()
const TEMPLATE_CACHE_MAX = 20
const TEMPLATE_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export function invalidateTemplateDetailCache(templateId: string) {
  templateDetailCache.delete(templateId)
}

export async function buildTemplateDetail(
  template: Pick<Template, 'id' | 'name' | 'category' | 'thumbnail' | 'svgPath' | 'fields' | 'printColorProfileMode' | 'adobeWorkingCmykPreset' | 'customIccPath' | 'sourceRgbIcc'> & {
    sheets?: Pick<TemplateSheet, 'id' | 'name' | 'order' | 'svgPath' | 'fields' | 'width' | 'height' | 'unit' | 'widthPx' | 'heightPx'>[]
  },
): Promise<TemplateDetail> {
  const cached = templateDetailCache.get(template.id)
  if (cached && (Date.now() - cached.timestamp) < TEMPLATE_CACHE_TTL) {
    return cached.detail
  }
  const sheetRecords = template.sheets ?? []

  let sheets: TemplateSheetDetail[]
  if (sheetRecords.length > 0) {
    sheets = await Promise.all(sheetRecords.sort((a, b) => a.order - b.order).map(async (sheet) => {
        let svgContent: string
        try {
          svgContent = await readFile(sheet.svgPath, 'utf-8')
        } catch {
          throw new Error(`SVG 파일을 찾을 수 없습니다: ${sheet.name} (${sheet.svgPath})`)
        }
        const storedFields = parseStoredFields(sheet.fields)
        const hydrated = hydrateSheetSvgAndFields(svgContent, storedFields)
        return {
          id: sheet.id,
          name: sheet.name,
          order: sheet.order,
          ...buildSheetDimensions(sheet, hydrated.svgContent),
          svgContent: hydrated.svgContent,
          fields: hydrated.fields,
        }
      }))
  } else {
    let svgContent: string
    try {
      svgContent = await readFile(template.svgPath, 'utf-8')
    } catch {
      throw new Error(`SVG 파일을 찾을 수 없습니다: ${template.svgPath}`)
    }
    const storedFields = parseStoredFields(template.fields)
    const hydrated = hydrateSheetSvgAndFields(svgContent, storedFields)
    sheets = [{
      id: getLegacySheetId(template.id),
      name: '대지 1',
      order: 0,
      ...buildSheetDimensions({ width: null, height: null, unit: null, widthPx: null, heightPx: null }, hydrated.svgContent),
      svgContent: hydrated.svgContent,
      fields: hydrated.fields,
    }]
  }

  const detail: TemplateDetail = {
    id: template.id,
    name: template.name,
    category: template.category,
    thumbnail: template.thumbnail,
    printSettings: buildTemplatePrintSettings(template),
    sheets,
  }

  if (templateDetailCache.size >= TEMPLATE_CACHE_MAX) {
    const oldestKey = templateDetailCache.keys().next().value!
    templateDetailCache.delete(oldestKey)
  }
  templateDetailCache.set(template.id, { detail, timestamp: Date.now() })

  return detail
}

/**
 * sheetSnapshot의 SVG 콘텐츠를 활용해 디스크 I/O 없이 TemplateDetail을 구성.
 * 프로젝트 로드 시 buildTemplateDetail 대신 사용하면 2~3초 → 즉시.
 */
export function buildTemplateDetailFromSnapshot(
  template: Pick<Template, 'id' | 'name' | 'category' | 'thumbnail' | 'printColorProfileMode' | 'adobeWorkingCmykPreset' | 'customIccPath' | 'sourceRgbIcc'>,
  sheetSnapshots: ProjectSheetSnapshot[],
): TemplateDetail {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    thumbnail: template.thumbnail,
    printSettings: buildTemplatePrintSettings(template),
    sheets: sheetSnapshots.map(snap => ({
      id: snap.sourceTemplateSheetId ?? snap.id,
      name: snap.name,
      order: snap.order,
      svgContent: snap.svgContent,
      fields: snap.fields,
      width: snap.width,
      height: snap.height,
      unit: snap.unit,
      widthPx: snap.widthPx,
      heightPx: snap.heightPx,
    })),
  }
}

export async function buildTemplateListItem(
  template: Pick<Template, 'id' | 'name' | 'category' | 'thumbnail' | 'svgPath' | 'printColorProfileMode' | 'adobeWorkingCmykPreset' | 'customIccPath' | 'sourceRgbIcc'> & {
    sheets?: Pick<TemplateSheet, 'id' | 'name' | 'order' | 'width' | 'height' | 'unit' | 'widthPx' | 'heightPx' | 'svgPath'>[]
  },
): Promise<TemplateListItem> {
  let sheets: TemplateSheetSummary[]
  if (template.sheets && template.sheets.length > 0) {
    sheets = await Promise.all(template.sheets.sort((a, b) => a.order - b.order).map(buildSheetSummary))
  } else {
    sheets = [await buildLegacySheetSummary(template)]
  }

  return {
    id: template.id,
    name: template.name,
    category: template.category,
    thumbnail: template.thumbnail,
    printSettings: buildTemplatePrintSettings(template),
    sheets,
  }
}
