function validateTemplateUploadInput(files: Array<{ name: string; type: string }>, name: string, category: string) {
  const trimmedName = name.trim()
  const trimmedCategory = category.trim()

  if (files.length === 0 || !trimmedName || !trimmedCategory) {
    return { ok: false, error: '필수 항목 누락' }
  }

  if (files.some(file => !file.name.endsWith('.svg') && file.type !== 'image/svg+xml')) {
    return { ok: false, error: 'SVG 파일만 업로드 가능합니다' }
  }

  return { ok: true }
}

describe('template upload validation', () => {
  it('정상적인 svg 여러 개와 템플릿명, 분류를 허용한다', () => {
    const result = validateTemplateUploadInput(
      [
        { name: 'business-card-front.svg', type: 'image/svg+xml' },
        { name: 'business-card-back.svg', type: 'image/svg+xml' },
      ],
      '국내용',
      '명함',
    )
    expect(result).toEqual({ ok: true })
  })

  it('템플릿명이 공백이면 거부한다', () => {
    const result = validateTemplateUploadInput(
      [{ name: 'business-card.svg', type: 'image/svg+xml' }],
      '   ',
      '명함',
    )
    expect(result).toEqual({ ok: false, error: '필수 항목 누락' })
  })

  it('분류가 공백이면 거부한다', () => {
    const result = validateTemplateUploadInput(
      [{ name: 'business-card.svg', type: 'image/svg+xml' }],
      '국내용',
      '   ',
    )
    expect(result).toEqual({ ok: false, error: '필수 항목 누락' })
  })

  it('svg가 아닌 파일이 포함되면 거부한다', () => {
    const result = validateTemplateUploadInput(
      [
        { name: 'business-card.svg', type: 'image/svg+xml' },
        { name: 'preview.png', type: 'image/png' },
      ],
      '국내용',
      '명함',
    )
    expect(result).toEqual({ ok: false, error: 'SVG 파일만 업로드 가능합니다' })
  })

  it('Illustrator SVG처럼 id 없는 text가 있어도 업로드 단계에서는 허용한다', () => {
    const result = validateTemplateUploadInput(
      [{ name: 'illustrator-export.svg', type: 'image/svg+xml' }],
      '대봉투',
      '봉투',
    )
    expect(result).toEqual({ ok: true })
  })
})
