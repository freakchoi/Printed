import { hasConfiguredPrintColorProfile } from '@/lib/print-color'
import { resolveTemplatePrintProfile } from '@/lib/print-color.server'

describe('print color profile resolution', () => {
  it('프로파일 미설정 템플릿은 export 대상이 아니다', () => {
    expect(hasConfiguredPrintColorProfile({
      colorProfileMode: null,
      adobeWorkingCmykPreset: null,
      customIccPath: null,
    })).toBe(false)
  })

  it('adobe preset 기반 프로파일 경로를 해석할 수 있다', async () => {
    const resolved = await resolveTemplatePrintProfile({
      colorProfileMode: 'adobe-working-cmyk',
      adobeWorkingCmykPreset: 'FOGRA39',
      customIccPath: null,
    })

    expect(resolved.sourceRgbIccPath).toContain('sRGB')
    expect(resolved.outputIccPath).toContain('FOGRA39')
  })
})
