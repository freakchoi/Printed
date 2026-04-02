import { getSvgDimensions } from '@/lib/svg-dimensions'
import { formatSheetDimensions } from '@/lib/template-model'

describe('getSvgDimensions', () => {
  it('mm 단위를 읽고 px로 변환한다', () => {
    expect(getSvgDimensions('<svg width="90mm" height="50mm" />')).toEqual({
      width: 90,
      height: 50,
      unit: 'mm',
      widthPx: 340.16,
      heightPx: 188.98,
      source: 'explicit-size',
    })
  })

  it('px 단위를 유지한다', () => {
    expect(getSvgDimensions('<svg width="260.79px" height="147.4px" />')).toEqual({
      width: 260.79,
      height: 147.4,
      unit: 'px',
      widthPx: 260.79,
      heightPx: 147.4,
      source: 'explicit-size',
    })
  })

  it('무단위 width/height 는 px로 간주한다', () => {
    expect(getSvgDimensions('<svg width="260.79" height="147.4" />')).toEqual({
      width: 260.79,
      height: 147.4,
      unit: 'px',
      widthPx: 260.79,
      heightPx: 147.4,
      source: 'explicit-size',
    })
  })

  it('viewBox 만 있으면 px fallback 을 사용한다', () => {
    expect(getSvgDimensions('<svg viewBox="0 0 260.79 147.4" />')).toEqual({
      width: 260.79,
      height: 147.4,
      unit: 'px',
      widthPx: 260.79,
      heightPx: 147.4,
      source: 'viewBox',
    })
  })

  it('pt 단위를 읽고 mm와 px로 변환한다', () => {
    expect(getSvgDimensions('<svg width="260.79pt" height="147.4pt" />')).toEqual({
      width: 260.79,
      height: 147.4,
      unit: 'pt',
      widthPx: 347.72,
      heightPx: 196.53,
      source: 'explicit-size',
    })
  })

  it('백분율 크기는 viewBox fallback 으로 처리한다', () => {
    const svg = '<svg width="100%" height="100%" viewBox="0 0 260.79 147.4"><rect x="2.83" y="2.83" width="255.12" height="141.73" /></svg>'
    expect(getSvgDimensions(svg)).toEqual({
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
      source: 'illustrator-viewBox-pt',
    })
  })

  it('illustrator 스타일 viewBox-only SVG를 mm로 보정한다', () => {
    const svg = '<svg id="_레이어_1" data-name="레이어 1" viewBox="0 0 260.79 147.4"><rect width="260.79" height="147.4" /><rect x="2.83" y="2.83" width="255.12" height="141.73" /></svg>'
    expect(getSvgDimensions(svg)).toEqual({
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
      source: 'illustrator-viewBox-pt',
    })
  })

  it('형식 문자열은 원본 단위로 포맷한다', () => {
    expect(formatSheetDimensions(90, 50, 'mm')).toBe('90 × 50 mm')
  })
})
