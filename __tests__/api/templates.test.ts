import { parseSVGFields } from '@/lib/svg-parser'

// svg-parser 통합 동작 검증 (API 레이어는 E2E로 커버)
describe('Template fields 통합', () => {
  it('업로드된 SVG에서 fields JSON을 생성한다', () => {
    const svg = `<svg>
      <text id="text-name">홍길동</text>
      <text id="text-email">hong@co.com</text>
    </svg>`
    const fields = parseSVGFields(svg)
    const fieldsJson = JSON.stringify(fields)
    const parsed = JSON.parse(fieldsJson)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].id).toBe('text-name')
    expect(parsed[1].defaultValue).toBe('hong@co.com')
  })
})
