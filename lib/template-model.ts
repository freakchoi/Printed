const VALID_SHEET_UNITS = ['px', 'mm', 'cm', 'in', 'pt', 'pc'] as const

export type FieldAlignment = 'left' | 'center' | 'right'
export type FieldWrapMode = 'preserve' | 'wrap'
export type FieldSourceType = 'explicit-id' | 'generated-id'
export type SheetDimensionUnit = 'px' | 'mm' | 'cm' | 'in' | 'pt' | 'pc'
export type SaveMode = 'create' | 'overwrite' | 'save-as-new'
export type ImageSelectionMode = 'all' | 'range'
export type ImageOutputMode = 'combined' | 'separate'
export type CombinedImageDirection = 'horizontal' | 'vertical'
export type PrintColorProfileMode = 'adobe-working-cmyk' | 'custom-icc'
export type SourceRgbIcc = 'sRGB' | 'AdobeRGB'
export type AdobeWorkingCmykPreset =
  | 'FOGRA39'
  | 'PSO_COATED_V3'
  | 'US_WEB_COATED_SWOP'
  | 'JAPAN_COLOR_2001_COATED'

export interface TemplatePrintSettings {
  colorProfileMode: PrintColorProfileMode | null
  adobeWorkingCmykPreset: AdobeWorkingCmykPreset | null
  customIccPath: string | null
  sourceRgbIcc: SourceRgbIcc | null
}

export interface TemplateField {
  id: string
  label: string
  defaultValue: string
  sourceType: FieldSourceType
  alignment: FieldAlignment
  wrapMode: FieldWrapMode
  order: number
  letterSpacing?: string | null
  textFrame?: {
    x: number
    width: number
    anchorX: number
    anchorMode: 'start' | 'middle' | 'end'
  } | null
}

export interface TemplateSheetSummary {
  id: string
  name: string
  order: number
  width: number
  height: number
  unit: SheetDimensionUnit
  widthPx: number
  heightPx: number
}

export interface TemplateSheetDetail extends TemplateSheetSummary {
  svgContent: string
  fields: TemplateField[]
}

export interface TemplateListItem {
  id: string
  name: string
  category: string
  thumbnail?: string | null
  printSettings: TemplatePrintSettings
  sheets: TemplateSheetSummary[]
}

export interface TemplateDetail {
  id: string
  name: string
  category: string
  thumbnail?: string | null
  printSettings: TemplatePrintSettings
  sheets: TemplateSheetDetail[]
}

export interface ProjectSheetSnapshot {
  id: string
  sourceTemplateSheetId: string | null
  name: string
  order: number
  svgContent: string
  fields: TemplateField[]
  width: number
  height: number
  unit: SheetDimensionUnit
  widthPx: number
  heightPx: number
}

export interface ProjectSummary {
  id: string
  name: string
  templateId: string
  createdAt: string
  updatedAt: string
  createdByActorName?: string | null
  lastEditedByActorName?: string | null
  lastExportedAt?: string | null
  lastExportedByActorName?: string | null
}

export interface SheetDimensions {
  width: number
  height: number
  unit: SheetDimensionUnit
  widthPx: number
  heightPx: number
}

export interface SheetFieldValue {
  value: string
  alignment: FieldAlignment
  wrapMode: FieldWrapMode
}

export type ProjectValuesBySheet = Record<string, Record<string, SheetFieldValue>>

type SnapshotDimensionCarrier = Pick<ProjectSheetSnapshot, 'width' | 'height' | 'unit' | 'widthPx' | 'heightPx'>

function isTemplateField(value: unknown): value is TemplateField {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.defaultValue === 'string' &&
    typeof value.sourceType === 'string' &&
    typeof value.alignment === 'string' &&
    typeof value.wrapMode === 'string' &&
    typeof value.order === 'number'
}

export function createProjectSheetSnapshots(sheets: TemplateSheetDetail[]): ProjectSheetSnapshot[] {
  return sheets.map(sheet => ({
    id: sheet.id,
    sourceTemplateSheetId: sheet.id,
    name: sheet.name,
    order: sheet.order,
    svgContent: sheet.svgContent,
    fields: sheet.fields,
    width: sheet.width,
    height: sheet.height,
    unit: sheet.unit,
    widthPx: sheet.widthPx,
    heightPx: sheet.heightPx,
  }))
}

export function normalizeProjectSheetSnapshot(rawSnapshot: unknown, fallbackSheets: TemplateSheetDetail[]): ProjectSheetSnapshot[] {
  if (!Array.isArray(rawSnapshot)) return createProjectSheetSnapshots(fallbackSheets)

  const fallbackById = new Map(fallbackSheets.map(sheet => [sheet.id, sheet]))
  const snapshots = rawSnapshot.flatMap((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string') return []
    const fallback = (
      typeof item.sourceTemplateSheetId === 'string' && fallbackById.get(item.sourceTemplateSheetId)
    ) || fallbackById.get(item.id) || fallbackSheets[index]
    if (!fallback) return []

    const fields = Array.isArray(item.fields) && item.fields.every(isTemplateField)
      ? item.fields
      : fallback.fields

    const width = typeof item.width === 'number' ? item.width : fallback.width
    const height = typeof item.height === 'number' ? item.height : fallback.height
    const widthPx = typeof item.widthPx === 'number' ? item.widthPx : fallback.widthPx
    const heightPx = typeof item.heightPx === 'number' ? item.heightPx : fallback.heightPx

    return [{
      id: item.id,
      sourceTemplateSheetId: typeof item.sourceTemplateSheetId === 'string' ? item.sourceTemplateSheetId : fallback.id,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : fallback.name,
      order: typeof item.order === 'number' ? item.order : index,
      svgContent: typeof item.svgContent === 'string' && item.svgContent ? item.svgContent : fallback.svgContent,
      fields,
      width,
      height,
      unit: typeof item.unit === 'string' && VALID_SHEET_UNITS.includes(item.unit as any)
        ? item.unit as SheetDimensionUnit
        : fallback.unit,
      widthPx,
      heightPx,
    }]
  })

  if (snapshots.length === 0) return createProjectSheetSnapshots(fallbackSheets)

  return snapshots
    .sort((a, b) => a.order - b.order)
    .map((sheet, index) => ({ ...sheet, order: index }))
}

function dimensionsEqual(a: SnapshotDimensionCarrier, b: SnapshotDimensionCarrier) {
  return a.width === b.width &&
    a.height === b.height &&
    a.unit === b.unit &&
    a.widthPx === b.widthPx &&
    a.heightPx === b.heightPx
}

export function reconcileProjectSheetSnapshotDimensions(
  snapshot: ProjectSheetSnapshot[],
  templateSheets: TemplateSheetDetail[],
): ProjectSheetSnapshot[] {
  const templateById = new Map(templateSheets.map(sheet => [sheet.id, sheet]))
  let changed = false

  const reconciled = snapshot.map((sheet) => {
    if (!sheet.sourceTemplateSheetId) {
      return sheet
    }

    const templateSheet = templateById.get(sheet.sourceTemplateSheetId)
    if (!templateSheet) {
      return sheet
    }

    const nextDimensions: SnapshotDimensionCarrier = {
      width: templateSheet.width,
      height: templateSheet.height,
      unit: templateSheet.unit,
      widthPx: templateSheet.widthPx,
      heightPx: templateSheet.heightPx,
    }

    if (dimensionsEqual(sheet, nextDimensions)) {
      return sheet
    }

    changed = true
    return {
      ...sheet,
      ...nextDimensions,
    }
  })

  return changed ? reconciled : snapshot
}

export function getLegacySheetId(templateId: string) {
  return `legacy-${templateId}`
}

export function makeFieldDisplayName(index: number) {
  return `텍스트 ${index + 1}`
}

function formatDimensionValue(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

export function formatSheetDimensions(width: number, height: number, unit: SheetDimensionUnit) {
  return `${formatDimensionValue(width)} × ${formatDimensionValue(height)} ${unit}`
}

export function makeArtboardDisplayName(index: number, name: string) {
  return `${String(index + 1).padStart(2, '0')} · ${name}`
}

export function createDefaultValuesForSheets(sheets: Pick<TemplateSheetDetail, 'id' | 'fields'>[]): ProjectValuesBySheet {
  return sheets.reduce<ProjectValuesBySheet>((acc, sheet) => {
    acc[sheet.id] = sheet.fields.reduce<Record<string, SheetFieldValue>>((fieldAcc, field) => {
      fieldAcc[field.id] = {
        value: field.defaultValue,
        alignment: field.alignment,
        wrapMode: field.wrapMode,
      }
      return fieldAcc
    }, {})
    return acc
  }, {})
}

export function createEmptyValuesForSheets(sheets: Pick<TemplateSheetDetail, 'id'>[]): ProjectValuesBySheet {
  return sheets.reduce<ProjectValuesBySheet>((acc, sheet) => {
    acc[sheet.id] = {}
    return acc
  }, {})
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNestedFieldValue(value: unknown): value is SheetFieldValue {
  return isRecord(value) && typeof value.value === 'string'
}

export function normalizeProjectValues(rawValues: unknown, sheets: Pick<TemplateSheetDetail, 'id' | 'fields'>[]): ProjectValuesBySheet {
  const normalized = createEmptyValuesForSheets(sheets)
  if (!isRecord(rawValues)) return normalized

  const firstSheet = sheets[0]

  for (const sheet of sheets) {
    const rawSheet = rawValues[sheet.id]
    if (!isRecord(rawSheet)) continue

    for (const field of sheet.fields) {
      const rawField = rawSheet[field.id]
      if (typeof rawField === 'string') {
        normalized[sheet.id][field.id] = {
          value: rawField,
          alignment: field.alignment,
          wrapMode: 'preserve',
        }
        continue
      }

      if (isNestedFieldValue(rawField)) {
        normalized[sheet.id][field.id] = {
          value: rawField.value,
          alignment: rawField.alignment ?? field.alignment,
          wrapMode: rawField.wrapMode ?? 'preserve',
        }
      }
    }
  }

  if (firstSheet) {
    for (const field of firstSheet.fields) {
      const rawFlatField = rawValues[field.id]
      if (typeof rawFlatField === 'string') {
        normalized[firstSheet.id][field.id] = {
          value: rawFlatField,
          alignment: field.alignment,
          wrapMode: 'preserve',
        }
        continue
      }

      if (isNestedFieldValue(rawFlatField)) {
        normalized[firstSheet.id][field.id] = {
          value: rawFlatField.value,
          alignment: rawFlatField.alignment ?? field.alignment,
          wrapMode: rawFlatField.wrapMode ?? 'preserve',
        }
      }
    }
  }

  return normalized
}
