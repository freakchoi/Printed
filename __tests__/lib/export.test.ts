import { buildExportSVG } from '@/lib/export'

describe('buildExportSVG', () => {
  it('SVG에 values를 적용한 문자열을 반환한다', () => {
    const svg = '<svg><text id="text-name">홍길동</text></svg>'
    const values = { 'text-name': '이순신' }
    const result = buildExportSVG(svg, values)
    expect(result).toContain('>이순신<')
    expect(result).not.toContain('>홍길동<')
  })
})
