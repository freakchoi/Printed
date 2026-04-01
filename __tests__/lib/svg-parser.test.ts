import { parseSVGFields, applyValuesToSVG } from '@/lib/svg-parser'

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="350" height="200">
  <text id="text-name" x="20" y="50">홍길동</text>
  <text id="text-title" x="20" y="70">마케팅팀 선임</text>
  <text id="text-phone" x="20" y="90">010-0000-0000</text>
</svg>`

describe('parseSVGFields', () => {
  it('SVG에서 text 요소를 추출한다', () => {
    const fields = parseSVGFields(SAMPLE_SVG)
    expect(fields).toHaveLength(3)
    expect(fields[0]).toEqual({ id: 'text-name', label: 'name', defaultValue: '홍길동' })
    expect(fields[1]).toEqual({ id: 'text-title', label: 'title', defaultValue: '마케팅팀 선임' })
  })

  it('text 요소가 없으면 빈 배열 반환', () => {
    const fields = parseSVGFields('<svg></svg>')
    expect(fields).toHaveLength(0)
  })

  it('id 없는 text 요소는 무시한다', () => {
    const svg = '<svg><text>no id</text><text id="text-a">with id</text></svg>'
    const fields = parseSVGFields(svg)
    expect(fields).toHaveLength(1)
    expect(fields[0].id).toBe('text-a')
  })

  it('id가 첫 번째 속성인 text 요소도 파싱한다', () => {
    const svg = '<svg><text id="text-name">홍길동</text></svg>'
    const fields = parseSVGFields(svg)
    expect(fields).toHaveLength(1)
    expect(fields[0].id).toBe('text-name')
  })

  it('tspan이 있는 text 요소도 defaultValue를 파싱한다', () => {
    const svg = '<svg><text id="text-name"><tspan x="0" y="0">홍길동</tspan></text></svg>'
    const fields = parseSVGFields(svg)
    expect(fields).toHaveLength(1)
    expect(fields[0].defaultValue).toBe('홍길동')
  })
})

describe('applyValuesToSVG', () => {
  it('지정한 id의 text 내용을 교체한다', () => {
    const result = applyValuesToSVG(SAMPLE_SVG, { 'text-name': '이순신' })
    expect(result).toContain('>이순신<')
    expect(result).toContain('>마케팅팀 선임<')
  })

  it('존재하지 않는 id는 무시한다', () => {
    const result = applyValuesToSVG(SAMPLE_SVG, { 'text-unknown': '값' })
    expect(result).toContain('>홍길동<')
  })

  it('value에 $ 문자가 있어도 올바르게 교체한다', () => {
    const result = applyValuesToSVG(SAMPLE_SVG, { 'text-name': '$100' })
    expect(result).toContain('>$100<')
  })
})
