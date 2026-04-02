import { DOMParser } from '@xmldom/xmldom'
import type { SheetDimensionUnit } from '@/lib/template-model'

export interface ParsedSvgDimensions {
  width: number
  height: number
  unit: SheetDimensionUnit
  widthPx: number
  heightPx: number
  source: 'explicit-size' | 'viewBox' | 'illustrator-viewBox-pt' | 'fallback'
}

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 675
const ABSOLUTE_UNIT_FACTORS: Record<SheetDimensionUnit, number> = {
  px: 1,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  pt: 96 / 72,
  pc: 16,
}

function toNumber(value: string | null) {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseSvgLength(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  const match = trimmed.match(/^([0-9]*\.?[0-9]+)\s*(px|mm|cm|in|pt|pc)?$/i)
  if (!match) return null

  const numeric = Number.parseFloat(match[1])
  if (!Number.isFinite(numeric) || numeric <= 0) return null

  const unit = (match[2]?.toLowerCase() ?? 'px') as SheetDimensionUnit
  return { value: numeric, unit }
}

function toPixels(value: number, unit: SheetDimensionUnit) {
  return Number((value * ABSOLUTE_UNIT_FACTORS[unit]).toFixed(2))
}

function ptToMm(value: number) {
  return Number((value * 25.4 / 72).toFixed(2))
}

function isNear(value: number, target: number, tolerance = 0.12) {
  return Math.abs(value - target) <= tolerance
}

function isNearHalfMillimeter(value: number, tolerance = 0.12) {
  return isNear(value * 2, Math.round(value * 2), tolerance * 2)
}

function extractNumericAttributes(svgString: string) {
  const matches = [...svgString.matchAll(/\s(?:x|y|x1|x2|y1|y2|width|height|stroke-width|font-size)="([0-9]*\.?[0-9]+)"/g)]
  return matches
    .map(match => Number.parseFloat(match[1]))
    .filter(value => Number.isFinite(value) && value > 0)
}

function detectIllustratorPtViewBox(
  svg: { getAttribute(name: string): string | null } | null,
  svgString: string,
): ParsedSvgDimensions | null {
  const parts = svg?.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number.parseFloat)
  if (!parts || parts.length !== 4) return null

  const [, , widthPt, heightPt] = parts
  if (!Number.isFinite(widthPt) || widthPt <= 0 || !Number.isFinite(heightPt) || heightPt <= 0) return null

  const widthMm = ptToMm(widthPt)
  const heightMm = ptToMm(heightPt)
  if (!isNearHalfMillimeter(widthMm) || !isNearHalfMillimeter(heightMm)) return null

  const numericAttributes = extractNumericAttributes(svgString)
  const guideLikeMatches = numericAttributes.filter(value => {
    const mmValue = value * 25.4 / 72
    const isPtLike = !Number.isInteger(value)
    return isPtLike && (isNear(mmValue, Math.round(mmValue), 0.08) || isNear(mmValue * 2, Math.round(mmValue * 2), 0.08))
  })

  if (guideLikeMatches.length < 3) return null

  return {
    width: widthMm,
    height: heightMm,
    unit: 'mm',
    widthPx: toPixels(widthMm, 'mm'),
    heightPx: toPixels(heightMm, 'mm'),
    source: 'illustrator-viewBox-pt',
  }
}

function fromViewBox(svg: { getAttribute(name: string): string | null } | null): ParsedSvgDimensions | null {
  const parts = svg?.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number.parseFloat)
  if (!parts || parts.length !== 4) return null
  const [, , width, height] = parts
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null
  return {
    width,
    height,
    unit: 'px',
    widthPx: width,
    heightPx: height,
    source: 'viewBox',
  }
}

export function getSvgDimensions(svgString: string): ParsedSvgDimensions {
  if (!svgString.trim()) {
    return {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      unit: 'px',
      widthPx: DEFAULT_WIDTH,
      heightPx: DEFAULT_HEIGHT,
      source: 'fallback',
    }
  }

  try {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml')
    const svg = doc.getElementsByTagName('svg').item(0)
    if (!svg) {
      return {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        unit: 'px',
        widthPx: DEFAULT_WIDTH,
        heightPx: DEFAULT_HEIGHT,
        source: 'fallback',
      }
    }

    const width = parseSvgLength(svg.getAttribute('width'))
    const height = parseSvgLength(svg.getAttribute('height'))
    if (width && height && width.unit === height.unit) {
      return {
        width: width.value,
        height: height.value,
        unit: width.unit,
        widthPx: toPixels(width.value, width.unit),
        heightPx: toPixels(height.value, height.unit),
        source: 'explicit-size',
      }
    }

    if (!width && !height) {
      const illustratorDimensions = detectIllustratorPtViewBox(svg, svgString)
      if (illustratorDimensions) {
        return illustratorDimensions
      }
    }

    const viewBoxDimensions = fromViewBox(svg)
    if (viewBoxDimensions) {
      return viewBoxDimensions
    }

    if (width && height) {
      return {
        width: width.value,
        height: height.value,
        unit: 'px',
        widthPx: width.value,
        heightPx: height.value,
        source: 'fallback',
      }
    }

    return {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      unit: 'px',
      widthPx: DEFAULT_WIDTH,
      heightPx: DEFAULT_HEIGHT,
      source: 'fallback',
    }
  } catch {
    return {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      unit: 'px',
      widthPx: DEFAULT_WIDTH,
      heightPx: DEFAULT_HEIGHT,
      source: 'fallback',
    }
  }
}
