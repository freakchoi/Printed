import { applyFieldValuesToSVG, normalizeSVGForEditing, parseSVGFields } from '@/lib/svg-parser'

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="350" height="200">
  <text id="text-name" x="20" y="50">홍길동</text>
  <text x="20" y="70">마케팅팀 선임</text>
  <text id="text-phone" text-anchor="end" x="20" y="90">010-0000-0000</text>
</svg>`

describe('normalizeSVGForEditing', () => {
  it('id 없는 text 요소에도 generated id를 부여한다', () => {
    const result = normalizeSVGForEditing(SAMPLE_SVG)
    expect(result.fields).toHaveLength(3)
    expect(result.fields[1].id).toBe('text-auto-1')
    expect(result.fields[1].sourceType).toBe('generated-id')
    expect(result.normalizedSvg).toContain('data-printed-generated="true"')
  })

  it('text-anchor를 기반으로 alignment를 파싱한다', () => {
    const result = normalizeSVGForEditing(SAMPLE_SVG)
    expect(result.fields[0].alignment).toBe('left')
    expect(result.fields[2].alignment).toBe('right')
  })

  it('tspan 여러 줄이 있으면 wrap 모드로 파싱한다', () => {
    const svg = '<svg><text><tspan x="0" y="0">한 줄</tspan><tspan x="0" dy="12">두 줄</tspan></text></svg>'
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].wrapMode).toBe('preserve')
    expect(result.fields[0].defaultValue).toBe('한 줄 두 줄')
  })

  it('Illustrator가 한 줄 숫자를 여러 tspan으로 쪼개도 한 줄 텍스트로 합친다', () => {
    const svg = '<svg><text><tspan x="0" y="0">01</tspan><tspan x="8" y="0">0</tspan><tspan x="12" y="0">.</tspan><tspan x="18" y="0">583</tspan><tspan x="34" y="0">5</tspan></text></svg>'
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].defaultValue).toBe('010.5835')
    expect(result.fields[0].wrapMode).toBe('preserve')
  })

  it('width가 있는 텍스트는 text frame 메타데이터를 저장한다', () => {
    const svg = '<svg><text id="text-name" x="20" y="40" width="120">홍길동</text></svg>'
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].textFrame).toEqual({
      x: 20,
      width: 120,
      anchorX: 20,
      anchorMode: 'start',
    })
    expect(result.normalizedSvg).toContain('data-printed-frame-width="120"')
  })

  it('폭 정보가 없을 때는 대응 rect보다 텍스트 자체 width를 우선 사용한다', () => {
    const svg = `
      <svg>
        <g>
          <rect x="100" y="10" width="80" height="20" fill="none" />
          <text id="text-name" transform="translate(110 25)">홍길동</text>
        </g>
      </svg>
    `
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].textFrame?.anchorX).toBe(0)
    expect(result.fields[0].textFrame?.anchorMode).toBe('start')
    expect(result.fields[0].textFrame?.width).toBeGreaterThan(0)
    expect(result.fields[0].textFrame?.width).toBeLessThan(80)
  })

  it('폭 정보가 없으면 원본 텍스트 width를 측정해 text frame으로 저장한다', () => {
    const svg = '<svg><text id="text-name" x="40" y="50" font-size="10">ABCD</text></svg>'
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].textFrame?.x).toBe(40)
    expect(result.fields[0].textFrame?.width).toBeGreaterThan(0)
    expect(result.fields[0].textFrame?.anchorX).toBe(40)
    expect(result.fields[0].textFrame?.anchorMode).toBe('start')
  })

  it('여러 줄 tspan은 전체 결합 문자열이 아니라 가장 넓은 줄 기준으로 width를 계산한다', () => {
    const svg = `
      <svg>
        <text id="text-name" transform="translate(10 20)" font-size="8">
          <tspan x="0" y="0">짧은 줄</tspan>
          <tspan x="0" y="12">조금 더 긴 둘째 줄</tspan>
        </text>
      </svg>
    `
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].textFrame?.width).toBeGreaterThan(0)
    expect(result.fields[0].textFrame?.width).toBeLessThan(120)
  })

  it('한 줄 안에서 여러 tspan이 x로 나뉜 경우 실제 x 범위 기준으로 width를 계산한다', () => {
    const svg = `
      <svg>
        <text id="text-name" font-size="10">
          <tspan x="0" y="0">AB</tspan>
          <tspan x="30" y="0">CD</tspan>
        </text>
      </svg>
    `
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].textFrame?.x).toBe(0)
    expect(result.fields[0].textFrame?.width).toBeGreaterThan(30)
  })

  it('같은 줄의 다음 text까지 간격이 있으면 그 gap을 frame width로 사용한다', () => {
    const svg = `
      <svg>
        <g>
          <text id="text-left" transform="translate(98.266 83.7666)" font-size="5.2">국내도 해외도 렌트카는 카모아</text>
          <text id="text-right" transform="translate(175.0954 83.7662)" font-size="5.2">전 세계 호텔과 렌트카를 한번에</text>
        </g>
      </svg>
    `
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].textFrame?.x).toBe(0)
    expect(result.fields[0].textFrame?.width).toBeCloseTo(76.8294, 3)
  })

  it('text 또는 첫 tspan의 letter-spacing을 field 메타와 svg 속성에 저장한다', () => {
    const svg = '<svg><text id="text-name" x="20" y="50"><tspan x="20" y="50" letter-spacing="0.12em">홍길동</tspan></text></svg>'
    const result = normalizeSVGForEditing(svg)
    expect(result.fields[0].letterSpacing).toBe('0.12em')
    expect(result.normalizedSvg).toContain('data-printed-letter-spacing="0.12em"')
    expect(result.normalizedSvg).toContain('letter-spacing="0.12em"')
  })
})

describe('parseSVGFields', () => {
  it('SVG에서 편집 가능한 text 요소를 추출한다', () => {
    const fields = parseSVGFields(SAMPLE_SVG)
    expect(fields).toHaveLength(3)
    expect(fields[0].id).toBe('text-name')
    expect(fields[1].id).toBe('text-auto-1')
  })

  it('text 요소가 없으면 빈 배열 반환', () => {
    const fields = parseSVGFields('<svg></svg>')
    expect(fields).toHaveLength(0)
  })
})

describe('applyFieldValuesToSVG', () => {
  it('지정한 id의 text 내용을 교체한다', () => {
    const normalized = normalizeSVGForEditing(SAMPLE_SVG)
    const result = applyFieldValuesToSVG(normalized.normalizedSvg, {
      'text-name': { value: '이순신', alignment: 'left', wrapMode: 'preserve' },
    })
    expect(result).toContain('이순신')
    expect(result).toContain('마케팅팀 선임')
  })

  it('wrap 모드면 개행을 여러 tspan으로 변환한다', () => {
    const normalized = normalizeSVGForEditing('<svg><text id="text-name" x="0" y="0">홍길동</text></svg>')
    const result = applyFieldValuesToSVG(normalized.normalizedSvg, {
      'text-name': { value: '첫 줄\n둘째 줄', alignment: 'center', wrapMode: 'wrap' },
    })
    expect(result).toContain('text-anchor="middle"')
    expect(result).toContain('<tspan')
    expect(result).toContain('첫 줄')
    expect(result).toContain('둘째 줄')
  })

  it('원본이 tspan 기반이면 preserve 모드에서도 tspan과 좌표를 유지한다', () => {
    const normalized = normalizeSVGForEditing('<svg><text id="text-name"><tspan x="10" y="20">홍길동</tspan></text></svg>')
    const result = applyFieldValuesToSVG(normalized.normalizedSvg, {
      'text-name': { value: '이순신', alignment: 'left', wrapMode: 'preserve' },
    })
    expect(result).toContain('<tspan')
    expect(result).toContain('x="10"')
    expect(result).toContain('y="20"')
    expect(result).toContain('이순신')
  })

  it('text frame이 있으면 가운데 정렬을 텍스트 박스 중심으로 계산한다', () => {
    const normalized = normalizeSVGForEditing('<svg><text id="text-name" x="20" y="40" width="120">홍길동</text></svg>')
    const result = applyFieldValuesToSVG(normalized.normalizedSvg, {
      'text-name': { value: '이순신', alignment: 'center', wrapMode: 'preserve' },
    })
    expect(result).toContain('text-anchor="middle"')
    expect(result).toContain('x="80"')
  })

  it('text frame이 있으면 우측 정렬도 텍스트 박스 우측 기준으로 계산한다', () => {
    const normalized = normalizeSVGForEditing('<svg><text id="text-name" x="20" y="40" width="120">홍길동</text></svg>')
    const result = applyFieldValuesToSVG(normalized.normalizedSvg, {
      'text-name': { value: '이순신', alignment: 'right', wrapMode: 'preserve' },
    })
    expect(result).toContain('text-anchor="end"')
    expect(result).toContain('x="140"')
  })

  it('transform 기반 텍스트도 같은 rect 폭 안에서 중앙 정렬한다', () => {
    const normalized = normalizeSVGForEditing(`
      <svg>
        <g>
          <rect x="100" y="10" width="80" height="20" fill="none" />
          <text id="text-name" transform="translate(110 25)">홍길동</text>
        </g>
      </svg>
    `)
    const result = applyFieldValuesToSVG(normalized.normalizedSvg, {
      'text-name': { value: '이순신', alignment: 'center', wrapMode: 'preserve' },
    })
    expect(result).toContain('text-anchor="middle"')
    expect(result).toContain('x="20.759765625"')
  })

  it('text 수정 후에도 imported letter-spacing을 유지한다', () => {
    const normalized = normalizeSVGForEditing('<svg><text id="text-name" x="10" y="20" letter-spacing="0.08em">홍길동</text></svg>')
    const result = applyFieldValuesToSVG(normalized.normalizedSvg, {
      'text-name': { value: '이순신', alignment: 'left', wrapMode: 'preserve' },
    })
    expect(result).toContain('data-printed-letter-spacing="0.08em"')
    expect(result).toContain('letter-spacing="0.08em"')
    expect(result).toContain('이순신')
  })

  it('새로 생성한 tspan에도 letter-spacing과 layout stabilizer를 복제한다', () => {
    const normalized = normalizeSVGForEditing('<svg><text id="text-name" x="10" y="20" letter-spacing="0.08em">홍길동</text></svg>')
    const result = applyFieldValuesToSVG(normalized.normalizedSvg, {
      'text-name': { value: '이순신', alignment: 'left', wrapMode: 'preserve' },
    })

    expect(result).toContain('<tspan')
    expect(result).toContain('letter-spacing="0.08em"')
    expect(result).toContain('font-kerning="none"')
    expect(result).toContain('text-rendering="geometricPrecision"')
    expect(result).toContain('xml:space="preserve"')
  })
})
