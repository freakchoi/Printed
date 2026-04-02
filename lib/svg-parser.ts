import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { createCanvas, registerFont } from 'canvas'
import type { FieldAlignment, FieldSourceType, FieldWrapMode, SheetFieldValue, TemplateField } from '@/lib/template-model'

const serializer = new XMLSerializer()
type ParsedSvgDocument = ReturnType<typeof parseSvgDocument>
type ParsedSvgElement = ReturnType<ParsedSvgDocument['createElement']>
type TextAnchorMode = 'start' | 'middle' | 'end'
type TextFrame = NonNullable<TemplateField['textFrame']>

const FRAME_X_ATTRIBUTE = 'data-printed-frame-x'
const FRAME_WIDTH_ATTRIBUTE = 'data-printed-frame-width'
const FRAME_ANCHOR_X_ATTRIBUTE = 'data-printed-anchor-x'
const FRAME_ANCHOR_MODE_ATTRIBUTE = 'data-printed-anchor-mode'
const LETTER_SPACING_ATTRIBUTE = 'data-printed-letter-spacing'
const measurementContext = createCanvas(1, 1).getContext('2d')
let measurementFontsRegistered = false

const FONT_STYLE_TO_WEIGHT: Array<{ pattern: RegExp; weight: string }> = [
  { pattern: /extralight|ultralight/i, weight: '200' },
  { pattern: /light/i, weight: '300' },
  { pattern: /regular|book|normal/i, weight: '400' },
  { pattern: /medium/i, weight: '500' },
  { pattern: /semibold|semi bold|demibold/i, weight: '600' },
  { pattern: /extrabold|extra bold|ultrabold/i, weight: '800' },
  { pattern: /black|heavy/i, weight: '900' },
  { pattern: /bold/i, weight: '700' },
  { pattern: /thin/i, weight: '100' },
]

const MEASUREMENT_FONT_REGISTRY: Array<{ path: string; family: string; weight?: string }> = [
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-Thin.otf', family: 'Pretendard', weight: '100' },
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-ExtraLight.otf', family: 'Pretendard', weight: '200' },
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-Light.otf', family: 'Pretendard', weight: '300' },
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-Regular.otf', family: 'Pretendard', weight: '400' },
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-Medium.otf', family: 'Pretendard', weight: '500' },
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-SemiBold.otf', family: 'Pretendard', weight: '600' },
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-Bold.otf', family: 'Pretendard', weight: '700' },
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-ExtraBold.otf', family: 'Pretendard', weight: '800' },
  { path: '/Users/choeseoyun/Library/Fonts/Pretendard-Black.otf', family: 'Pretendard', weight: '900' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-Thin.otf', family: 'Pretendard JP', weight: '100' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-ExtraLight.otf', family: 'Pretendard JP', weight: '200' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-Light.otf', family: 'Pretendard JP', weight: '300' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-Regular.otf', family: 'Pretendard JP', weight: '400' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-Medium.otf', family: 'Pretendard JP', weight: '500' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-SemiBold.otf', family: 'Pretendard JP', weight: '600' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-Bold.otf', family: 'Pretendard JP', weight: '700' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-ExtraBold.otf', family: 'Pretendard JP', weight: '800' },
  { path: '/Users/choeseoyun/Library/Fonts/PretendardJP-Black.otf', family: 'Pretendard JP', weight: '900' },
  { path: '/Users/choeseoyun/Library/Fonts/GmarketSansTTFLight.ttf', family: 'Gmarket Sans TTF', weight: '300' },
  { path: '/Users/choeseoyun/Library/Fonts/GmarketSansTTFMedium.ttf', family: 'Gmarket Sans TTF', weight: '500' },
  { path: '/Users/choeseoyun/Library/Fonts/GmarketSansTTFBold.ttf', family: 'Gmarket Sans TTF', weight: '700' },
  { path: '/Users/choeseoyun/Library/Fonts/GmarketSansLight.otf', family: 'Gmarket Sans', weight: '300' },
  { path: '/Users/choeseoyun/Library/Fonts/GmarketSansMedium.otf', family: 'Gmarket Sans', weight: '500' },
  { path: '/Users/choeseoyun/Library/Fonts/GmarketSansBold.otf', family: 'Gmarket Sans', weight: '700' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-Thin.ttf', family: 'Noto Sans JP', weight: '100' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-ExtraLight.ttf', family: 'Noto Sans JP', weight: '200' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-Light.ttf', family: 'Noto Sans JP', weight: '300' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-Regular.ttf', family: 'Noto Sans JP', weight: '400' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-Medium.ttf', family: 'Noto Sans JP', weight: '500' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-SemiBold.ttf', family: 'Noto Sans JP', weight: '600' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-Bold.ttf', family: 'Noto Sans JP', weight: '700' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-ExtraBold.ttf', family: 'Noto Sans JP', weight: '800' },
  { path: '/Users/choeseoyun/Library/Fonts/NotoSansJP-Black.ttf', family: 'Noto Sans JP', weight: '900' },
  { path: '/System/Library/Fonts/Supplemental/AppleMyungjo.ttf', family: 'AppleMyungjo', weight: '400' },
]

function ensureMeasurementFontsRegistered() {
  if (measurementFontsRegistered) return

  for (const entry of MEASUREMENT_FONT_REGISTRY) {
    try {
      registerFont(entry.path, {
        family: entry.family,
        weight: entry.weight,
      })
    } catch {
      // Ignore duplicate registration or unsupported font files.
    }
  }

  measurementFontsRegistered = true
}

function parseSvgDocument(svgString: string) {
  return new DOMParser().parseFromString(svgString, 'image/svg+xml')
}

function getTextElements(svgString: string) {
  const doc = parseSvgDocument(svgString)
  const textNodes = doc.getElementsByTagName('text')
  const elements: ParsedSvgElement[] = []
  for (let i = 0; i < textNodes.length; i += 1) {
    const node = textNodes.item(i)
    if (node) elements.push(node as ParsedSvgElement)
  }
  return { doc, elements }
}

function getStyleValue(style: string | null, property: string) {
  if (!style) return null
  const parts = style.split(';').map(part => part.trim()).filter(Boolean)
  const match = parts.find(part => part.startsWith(`${property}:`))
  return match ? match.split(':').slice(1).join(':').trim() : null
}

function parseNumericAttribute(value: string | null) {
  if (!value) return null
  const numeric = Number.parseFloat(value)
  return Number.isFinite(numeric) ? numeric : null
}

function getTextAnchorMode(textElement: ParsedSvgElement): TextAnchorMode {
  const attr = textElement.getAttribute('text-anchor')
  const style = getStyleValue(textElement.getAttribute('style'), 'text-anchor')
  const value = attr ?? style
  if (value === 'middle') return 'middle'
  if (value === 'end') return 'end'
  return 'start'
}

function getAlignment(textElement: ParsedSvgElement): FieldAlignment {
  const anchorMode = getTextAnchorMode(textElement)
  if (anchorMode === 'middle') return 'center'
  if (anchorMode === 'end') return 'right'
  return 'left'
}

function getWrapMode(textElement: ParsedSvgElement): FieldWrapMode {
  return 'preserve'
}

function collectTspanText(textElement: ParsedSvgElement) {
  const lines = collectTspanLines(textElement)
  if (!lines) return null
  return lines.map(line => line.text).join(' ').replace(/\s+/g, ' ').trim()
}

type TspanLine = {
  text: string
  minX: number | null
  maxX: number | null
}

function collectTspanLines(textElement: ParsedSvgElement): TspanLine[] | null {
  const tspans = textElement.getElementsByTagName('tspan')
  if (tspans.length === 0) return null

  const lines: TspanLine[] = []
  let currentLine = ''
  let currentY: number | null = null
  let currentMinX: number | null = null
  let currentMaxX: number | null = null
  const lineBreakThreshold = getFontSize(textElement) * 0.6

  for (let i = 0; i < tspans.length; i += 1) {
    const tspan = tspans.item(i)
    if (!tspan) continue

    const chunk = (tspan.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!chunk) continue

    const y = parseNumericAttribute(tspan.getAttribute('y'))
    const dy = parseNumericAttribute(tspan.getAttribute('dy'))
    const x = parseNumericAttribute(tspan.getAttribute('x'))
    const tspanWidth = measureTextWidth(textElement, chunk)
    const shouldBreakLine =
      currentLine.length > 0 &&
      (
        (y !== null && currentY !== null && Math.abs(y - currentY) > 0.1) ||
        (dy !== null && Math.abs(dy) >= lineBreakThreshold)
      )

    if (shouldBreakLine) {
      lines.push({ text: currentLine, minX: currentMinX, maxX: currentMaxX })
      currentLine = chunk
      currentMinX = x
      currentMaxX = x !== null ? x + tspanWidth : null
    } else {
      currentLine += chunk
      if (x !== null) {
        currentMinX = currentMinX === null ? x : Math.min(currentMinX, x)
        const chunkMaxX = x + tspanWidth
        currentMaxX = currentMaxX === null ? chunkMaxX : Math.max(currentMaxX, chunkMaxX)
      } else if (currentMinX === null && currentLine === chunk) {
        currentMinX = 0
        currentMaxX = tspanWidth
      } else if (currentMaxX !== null) {
        currentMaxX += tspanWidth
      }
    }

    if (y !== null) currentY = y
  }

  if (currentLine) {
    lines.push({ text: currentLine, minX: currentMinX, maxX: currentMaxX })
  }
  return lines
}

function getFieldValue(textElement: ParsedSvgElement) {
  const tspanText = collectTspanText(textElement)
  if (tspanText) {
    return tspanText
  }
  return (textElement.textContent ?? '').trim()
}

function getFontWeight(textElement: ParsedSvgElement) {
  const attr = textElement.getAttribute('font-weight')
  const style = getStyleValue(textElement.getAttribute('style'), 'font-weight')
  const raw = (attr ?? style ?? '').trim()
  if (raw) return raw

  const family = textElement.getAttribute('font-family') ?? getStyleValue(textElement.getAttribute('style'), 'font-family') ?? ''
  for (const entry of FONT_STYLE_TO_WEIGHT) {
    if (entry.pattern.test(family)) return entry.weight
  }

  return '400'
}

function getMeasurementFontFamily(textElement: ParsedSvgElement) {
  const attr = textElement.getAttribute('font-family')
  const style = getStyleValue(textElement.getAttribute('style'), 'font-family')
  const raw = (attr ?? style ?? 'sans-serif').trim()
  const candidates = raw
    .split(',')
    .map(part => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

  for (const candidate of candidates) {
    if (/PretendardJP|Pretendard JP/i.test(candidate)) return 'Pretendard JP'
    if (/Pretendard/i.test(candidate)) return 'Pretendard'
    if (/GmarketSansTTF|Gmarket Sans TTF/i.test(candidate)) return 'Gmarket Sans TTF'
    if (/GmarketSans|Gmarket Sans/i.test(candidate)) return 'Gmarket Sans'
    if (/NotoSansJP|Noto Sans JP/i.test(candidate)) return 'Noto Sans JP'
    if (/AdobeMyungjo|Adobe Myungjo|AppleMyungjo/i.test(candidate)) return 'AppleMyungjo'
  }

  const fallback = candidates.find(candidate => !/-KSCpc-EUC-H|-83pv-RKSJ-H/i.test(candidate))
  return fallback ?? 'sans-serif'
}

function getLetterSpacing(textElement: ParsedSvgElement) {
  const raw = getStoredLetterSpacingValue(textElement)
  if (!raw || raw === 'normal') return 0
  const numeric = Number.parseFloat(raw)
  return Number.isFinite(numeric) ? numeric : 0
}

function extractLetterSpacingValue(textElement: ParsedSvgElement) {
  const textAttr = textElement.getAttribute('letter-spacing')
  const textStyle = getStyleValue(textElement.getAttribute('style'), 'letter-spacing')
  const direct = textAttr ?? textStyle
  if (direct && direct.trim()) return direct.trim()

  const firstTspan = textElement.getElementsByTagName('tspan').item(0)
  const tspanAttr = firstTspan?.getAttribute('letter-spacing')
  const tspanStyle = getStyleValue(firstTspan?.getAttribute('style') ?? null, 'letter-spacing')
  const inherited = tspanAttr ?? tspanStyle
  return inherited?.trim() || null
}

function getStoredLetterSpacingValue(textElement: ParsedSvgElement) {
  const stored = textElement.getAttribute(LETTER_SPACING_ATTRIBUTE)
  if (stored && stored.trim()) return stored.trim()
  return extractLetterSpacingValue(textElement)
}

function setLetterSpacingMetadata(textElement: ParsedSvgElement, letterSpacing: string | null) {
  if (!letterSpacing || !letterSpacing.trim()) {
    textElement.removeAttribute(LETTER_SPACING_ATTRIBUTE)
    return
  }
  textElement.setAttribute(LETTER_SPACING_ATTRIBUTE, letterSpacing.trim())
}

function applyLetterSpacing(textElement: ParsedSvgElement, letterSpacing: string | null) {
  if (!letterSpacing || !letterSpacing.trim()) {
    textElement.removeAttribute('letter-spacing')
    return
  }
  textElement.setAttribute('letter-spacing', letterSpacing.trim())
}

function applyTextLayoutStabilizers(textElement: ParsedSvgElement, letterSpacing: string | null) {
  textElement.setAttribute('xml:space', 'preserve')
  textElement.setAttribute('font-kerning', 'none')
  textElement.setAttribute('text-rendering', 'geometricPrecision')
  applyLetterSpacing(textElement, letterSpacing)
}

function getFontSize(textElement: ParsedSvgElement) {
  const attr = textElement.getAttribute('font-size')
  const style = getStyleValue(textElement.getAttribute('style'), 'font-size')
  const raw = attr ?? style
  if (!raw) return 16
  const numeric = Number.parseFloat(raw)
  return Number.isFinite(numeric) ? numeric : 16
}

function measureTextWidth(textElement: ParsedSvgElement, text: string) {
  ensureMeasurementFontsRegistered()
  const fontSize = getFontSize(textElement)
  const fontWeight = getFontWeight(textElement)
  const fontFamily = getMeasurementFontFamily(textElement)
  const letterSpacing = getLetterSpacing(textElement)

  measurementContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const metrics = measurementContext.measureText(text)
  const spacingWidth = text.length > 1 ? letterSpacing * (text.length - 1) : 0
  return metrics.width + spacingWidth
}

function getBasePosition(textElement: ParsedSvgElement) {
  const firstTspan = textElement.getElementsByTagName('tspan').item(0)
  return {
    x: firstTspan?.getAttribute('x') ?? textElement.getAttribute('x'),
    y: firstTspan?.getAttribute('y') ?? textElement.getAttribute('y'),
    hadTspans: textElement.getElementsByTagName('tspan').length > 0,
  }
}

function parseTranslateTransform(transform: string | null) {
  if (!transform) return { x: 0, y: 0 }

  const translateMatch = transform.match(/translate\(([^)]+)\)/)
  if (translateMatch?.[1]) {
    const [rawX = '0', rawY = '0'] = translateMatch[1].split(/[\s,]+/).filter(Boolean)
    const x = Number.parseFloat(rawX)
    const y = Number.parseFloat(rawY)
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
    }
  }

  const matrixMatch = transform.match(/matrix\(([^)]+)\)/)
  if (matrixMatch?.[1]) {
    const values = matrixMatch[1].split(/[\s,]+/).map(part => Number.parseFloat(part)).filter(Number.isFinite)
    if (values.length === 6) {
      return {
        x: values[4] ?? 0,
        y: values[5] ?? 0,
      }
    }
  }

  return { x: 0, y: 0 }
}

function getLocalAnchorPosition(textElement: ParsedSvgElement) {
  const { x, y } = getBasePosition(textElement)
  return {
    x: parseNumericAttribute(x) ?? 0,
    y: parseNumericAttribute(y) ?? 0,
  }
}

function getAbsoluteAnchorPosition(textElement: ParsedSvgElement) {
  const local = getLocalAnchorPosition(textElement)
  const transform = parseTranslateTransform(textElement.getAttribute('transform'))
  return {
    x: local.x + transform.x,
    y: local.y + transform.y,
    localX: local.x,
    localY: local.y,
    transformX: transform.x,
    transformY: transform.y,
  }
}

function parseFrameFromAttributes(textElement: ParsedSvgElement): TextFrame | null {
  const width = parseNumericAttribute(textElement.getAttribute(FRAME_WIDTH_ATTRIBUTE))
  const frameX = parseNumericAttribute(textElement.getAttribute(FRAME_X_ATTRIBUTE))
  const anchorX = parseNumericAttribute(textElement.getAttribute(FRAME_ANCHOR_X_ATTRIBUTE))
  const anchorMode = textElement.getAttribute(FRAME_ANCHOR_MODE_ATTRIBUTE)

  if (width === null || frameX === null || anchorX === null) return null
  if (anchorMode !== 'start' && anchorMode !== 'middle' && anchorMode !== 'end') return null

  return {
    x: frameX,
    width,
    anchorX,
    anchorMode,
  }
}

function parseFrameFromExplicitWidth(textElement: ParsedSvgElement): TextFrame | null {
  const width = (
    parseNumericAttribute(textElement.getAttribute('inline-size')) ??
    parseNumericAttribute(getStyleValue(textElement.getAttribute('style'), 'inline-size')) ??
    parseNumericAttribute(textElement.getAttribute('width'))
  )

  if (width === null || width <= 0) return null

  const { x: localAnchorX } = getLocalAnchorPosition(textElement)
  const anchorMode = getTextAnchorMode(textElement)
  const frameX = anchorMode === 'middle'
    ? localAnchorX - (width / 2)
    : anchorMode === 'end'
      ? localAnchorX - width
      : localAnchorX

  return {
    x: frameX,
    width,
    anchorX: localAnchorX,
    anchorMode,
  }
}

function collectSiblingRects(textElement: ParsedSvgElement) {
  const parent = textElement.parentNode
  if (!parent || !('childNodes' in parent)) return [] as ParsedSvgElement[]

  const rects: ParsedSvgElement[] = []
  const childNodes = parent.childNodes
  for (let i = 0; i < childNodes.length; i += 1) {
    const child = childNodes.item(i) as ParsedSvgElement | null
    if (!child || child === textElement) continue
    if (child.nodeType !== 1) continue
    if (child.tagName !== 'rect') continue
    rects.push(child)
  }
  return rects
}

function collectSiblingTexts(textElement: ParsedSvgElement) {
  const parent = textElement.parentNode
  if (!parent || !('childNodes' in parent)) return [] as ParsedSvgElement[]

  const texts: ParsedSvgElement[] = []
  const childNodes = parent.childNodes
  for (let i = 0; i < childNodes.length; i += 1) {
    const child = childNodes.item(i) as ParsedSvgElement | null
    if (!child || child === textElement) continue
    if (child.nodeType !== 1) continue
    if (child.tagName !== 'text') continue
    texts.push(child)
  }
  return texts
}

function parseFrameFromSiblingRect(textElement: ParsedSvgElement): TextFrame | null {
  const { x: absoluteAnchorX, y: absoluteAnchorY, localX, transformX } = getAbsoluteAnchorPosition(textElement)
  const fontSize = getFontSize(textElement)
  const anchorMode = getTextAnchorMode(textElement)
  const tolerance = Math.max(fontSize, 4)

  const candidates = collectSiblingRects(textElement)
    .map((rect) => {
      const x = parseNumericAttribute(rect.getAttribute('x'))
      const y = parseNumericAttribute(rect.getAttribute('y')) ?? 0
      const width = parseNumericAttribute(rect.getAttribute('width'))
      const height = parseNumericAttribute(rect.getAttribute('height'))
      if (x === null || width === null || height === null || width <= 0 || height <= 0) return null

      const verticalMatch = absoluteAnchorY >= (y - fontSize) && absoluteAnchorY <= (y + height + fontSize * 0.5)
      if (!verticalMatch) return null

      const minX = x - tolerance
      const maxX = x + width + tolerance
      const horizontalMatch = absoluteAnchorX >= minX && absoluteAnchorX <= maxX
      if (!horizontalMatch) return null

      return { x, width, area: width * height }
    })
    .filter((candidate): candidate is { x: number; width: number; area: number } => candidate !== null)
    .sort((a, b) => a.area - b.area)

  const match = candidates[0]
  if (!match) return null

  return {
    x: match.x - transformX,
    width: match.width,
    anchorX: localX,
    anchorMode,
  }
}

function parseFrameFromSiblingTextGap(textElement: ParsedSvgElement): TextFrame | null {
  const { x: absoluteAnchorX, y: absoluteAnchorY, localX, transformX } = getAbsoluteAnchorPosition(textElement)
  const anchorMode = getTextAnchorMode(textElement)
  if (anchorMode !== 'start') return null

  const measured = parseFrameFromMeasuredText(textElement)
  if (!measured) return null

  const fontSize = getFontSize(textElement)
  const baselineTolerance = Math.max(fontSize * 0.45, 2)

  const candidates = collectSiblingTexts(textElement)
    .map((sibling) => {
      const siblingAnchor = getAbsoluteAnchorPosition(sibling)
      if (Math.abs(siblingAnchor.y - absoluteAnchorY) > baselineTolerance) return null
      if (siblingAnchor.x <= absoluteAnchorX) return null
      return siblingAnchor.x - absoluteAnchorX
    })
    .filter((gap): gap is number => gap !== null && Number.isFinite(gap))
    .sort((a, b) => a - b)

  const nextGap = candidates[0]
  if (!nextGap) return null

  if (nextGap <= measured.width + 2) return null
  if (nextGap > measured.width * 3.5) return null

  return {
    x: localX,
    width: nextGap,
    anchorX: localX,
    anchorMode,
  }
}

function parseFrameFromMeasuredText(textElement: ParsedSvgElement): TextFrame | null {
  const tspanLines = collectTspanLines(textElement)
  const rawValue = getFieldValue(textElement)
  if (!rawValue) return null

  let measuredWidth: number | null = null
  let measuredMinX: number | null = null

  if (tspanLines && tspanLines.length > 0) {
    const widths = tspanLines
      .map((line) => {
        if (line.minX !== null && line.maxX !== null) {
          return {
            width: line.maxX - line.minX,
            minX: line.minX,
          }
        }
        const width = measureTextWidth(textElement, line.text)
        return { width, minX: 0 }
      })
      .filter(line => Number.isFinite(line.width) && line.width > 0)

    if (widths.length > 0) {
      const widest = widths.reduce((current, line) => (line.width > current.width ? line : current), widths[0]!)
      measuredWidth = widest.width
      measuredMinX = widest.minX
    }
  }

  if (measuredWidth === null) {
    const lines = rawValue.split(/\r?\n/).filter(Boolean)
    const longestLine = lines.length > 0
      ? lines.reduce((longest, line) => (line.length > longest.length ? line : longest), lines[0]!)
      : rawValue
    const fallbackWidth = measureTextWidth(textElement, longestLine)
    if (!Number.isFinite(fallbackWidth) || fallbackWidth <= 0) return null
    measuredWidth = fallbackWidth
    measuredMinX = null
  }

  const { x: localAnchorX } = getLocalAnchorPosition(textElement)
  const anchorMode = getTextAnchorMode(textElement)
  const baseX = measuredMinX ?? localAnchorX
  const frameX = anchorMode === 'middle'
    ? baseX - (measuredWidth / 2)
    : anchorMode === 'end'
      ? baseX - measuredWidth
      : baseX

  return {
    x: frameX,
    width: measuredWidth,
    anchorX: localAnchorX,
    anchorMode,
  }
}

function extractTextFrame(textElement: ParsedSvgElement): TextFrame | null {
  return parseFrameFromExplicitWidth(textElement) ??
    parseFrameFromSiblingTextGap(textElement) ??
    parseFrameFromMeasuredText(textElement) ??
    parseFrameFromAttributes(textElement) ??
    parseFrameFromSiblingRect(textElement)
}

function setTextFrameAttributes(textElement: ParsedSvgElement, textFrame: TextFrame | null) {
  if (!textFrame) {
    textElement.removeAttribute(FRAME_X_ATTRIBUTE)
    textElement.removeAttribute(FRAME_WIDTH_ATTRIBUTE)
    textElement.removeAttribute(FRAME_ANCHOR_X_ATTRIBUTE)
    textElement.removeAttribute(FRAME_ANCHOR_MODE_ATTRIBUTE)
    return
  }

  textElement.setAttribute(FRAME_X_ATTRIBUTE, String(textFrame.x))
  textElement.setAttribute(FRAME_WIDTH_ATTRIBUTE, String(textFrame.width))
  textElement.setAttribute(FRAME_ANCHOR_X_ATTRIBUTE, String(textFrame.anchorX))
  textElement.setAttribute(FRAME_ANCHOR_MODE_ATTRIBUTE, textFrame.anchorMode)
}

function clearChildren(node: ParsedSvgElement) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

function resolveTextAnchorPosition(
  alignment: FieldAlignment,
  textFrame: TextFrame | null,
  fallbackX: string | null,
): { x: string | null; textAnchor: TextAnchorMode } {
  if (textFrame) {
    if (alignment === 'left') {
      return { x: String(textFrame.x), textAnchor: 'start' }
    }
    if (alignment === 'center') {
      return { x: String(textFrame.x + textFrame.width / 2), textAnchor: 'middle' }
    }
    return { x: String(textFrame.x + textFrame.width), textAnchor: 'end' }
  }

  if (alignment === 'left') {
    return { x: fallbackX, textAnchor: 'start' }
  }
  if (alignment === 'center') {
    return { x: fallbackX, textAnchor: 'middle' }
  }
  return { x: fallbackX, textAnchor: 'end' }
}

function setTextContent(
  doc: ParsedSvgDocument,
  textElement: ParsedSvgElement,
  value: string,
  wrapMode: FieldWrapMode,
  alignment: FieldAlignment,
) {
  const { x: fallbackX, y, hadTspans } = getBasePosition(textElement)
  const textFrame = extractTextFrame(textElement)
  const letterSpacing = getStoredLetterSpacingValue(textElement)
  const { x, textAnchor } = resolveTextAnchorPosition(alignment, textFrame, fallbackX)
  clearChildren(textElement)
  textElement.setAttribute('text-anchor', textAnchor)
  setLetterSpacingMetadata(textElement, letterSpacing)
  applyTextLayoutStabilizers(textElement, letterSpacing)

  const shouldWrap = value.includes('\n') || wrapMode === 'wrap'

  if (shouldWrap) {
    const lines = value.split(/\r?\n/)
    const lineHeight = Number((getFontSize(textElement) * 1.2).toFixed(2))

    lines.forEach((line, index) => {
      const tspan = doc.createElement('tspan')
      if (x !== null) tspan.setAttribute('x', x)
      if (index === 0) {
        if (y) tspan.setAttribute('y', y)
      } else {
        tspan.setAttribute('dy', String(lineHeight))
      }
      applyTextLayoutStabilizers(tspan, letterSpacing)
      tspan.appendChild(doc.createTextNode(line || ' '))
      textElement.appendChild(tspan)
    })
    return
  }

  if (hadTspans || x !== null || y) {
    const tspan = doc.createElement('tspan')
    if (x !== null) tspan.setAttribute('x', x)
    if (y) tspan.setAttribute('y', y)
    applyTextLayoutStabilizers(tspan, letterSpacing)
    tspan.appendChild(doc.createTextNode(value))
    textElement.appendChild(tspan)
    return
  }

  textElement.appendChild(doc.createTextNode(value))
}

export interface NormalizeSVGResult {
  normalizedSvg: string
  fields: TemplateField[]
  generatedFieldCount: number
}

export function normalizeSVGForEditing(svgString: string): NormalizeSVGResult {
  const { doc, elements } = getTextElements(svgString)
  const usedIds = new Set<string>()
  let generatedFieldCount = 0
  const fields: TemplateField[] = []

  for (const textElement of elements) {
    const defaultValue = getFieldValue(textElement)
    if (!defaultValue) continue

    let id = textElement.getAttribute('id')?.trim() ?? ''
    let sourceType: FieldSourceType = 'explicit-id'

    if (!id || usedIds.has(id)) {
      generatedFieldCount += 1
      id = `text-auto-${generatedFieldCount}`
      textElement.setAttribute('id', id)
      textElement.setAttribute('data-printed-generated', 'true')
      sourceType = 'generated-id'
    }

    const textFrame = extractTextFrame(textElement)
    const letterSpacing = extractLetterSpacingValue(textElement)
    setTextFrameAttributes(textElement, textFrame)
    setLetterSpacingMetadata(textElement, letterSpacing)
    applyTextLayoutStabilizers(textElement, letterSpacing)

    usedIds.add(id)
    fields.push({
      id,
      label: id.replace(/^text-/, ''),
      defaultValue,
      sourceType,
      alignment: getAlignment(textElement),
      wrapMode: getWrapMode(textElement),
      order: fields.length,
      letterSpacing,
      textFrame,
    })
  }

  return {
    normalizedSvg: serializer.serializeToString(doc),
    fields,
    generatedFieldCount,
  }
}

export function parseSVGFields(svgString: string): TemplateField[] {
  return normalizeSVGForEditing(svgString).fields
}

export function applyFieldValuesToSVG(svgString: string, values: Record<string, SheetFieldValue>): string {
  const { doc, elements } = getTextElements(svgString)
  const byId = new Map<string, ParsedSvgElement>()

  for (const element of elements) {
    const id = element.getAttribute('id')
    if (id) byId.set(id, element)
  }

  for (const [id, config] of Object.entries(values)) {
    const textElement = byId.get(id)
    if (!textElement) continue
    setTextContent(doc, textElement, config.value, config.wrapMode, config.alignment)
  }

  return serializer.serializeToString(doc)
}

export function applyValuesToSVG(svgString: string, values: Record<string, string>): string {
  const fieldValues = Object.entries(values).reduce<Record<string, SheetFieldValue>>((acc, [id, value]) => {
    acc[id] = {
      value,
      alignment: 'left',
      wrapMode: 'preserve',
    }
    return acc
  }, {})

  return applyFieldValuesToSVG(svgString, fieldValues)
}
