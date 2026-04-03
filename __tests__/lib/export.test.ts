import { PDFDocument } from 'pdf-lib'
import { buildExportHTMLForSheet, buildExportHTMLForSheets, buildExportSVG, fixPdfPageBoxes, getRasterExportDimensions, getSheetPdfSizePt, recomposePdfPagesToExactSize, resolvePdfRenderStrategy, selectRenderableSheets } from '@/lib/export'
import type { TemplateSheetDetail } from '@/lib/template-model'

describe('buildExportSVG', () => {
  it('SVG에 nested values를 적용한 문자열을 반환한다', () => {
    const svg = '<svg><text id="text-name">홍길동</text></svg>'
    const values = { 'text-name': { value: '이순신', alignment: 'left' as const, wrapMode: 'preserve' as const } }
    const result = buildExportSVG(svg, values)
    expect(result).toContain('이순신')
    expect(result).not.toContain('>홍길동<')
  })

  it('letter-spacing이 있는 text를 수정하면 생성된 tspan에도 자간 속성이 남는다', () => {
    const svg = '<svg><text id="text-name" x="10" y="20" letter-spacing="0.08em">홍길동</text></svg>'
    const values = { 'text-name': { value: '이순신', alignment: 'left' as const, wrapMode: 'preserve' as const } }
    const result = buildExportSVG(svg, values)
    expect(result).toContain('letter-spacing="0.08em"')
    expect(result).toContain('font-kerning="none"')
    expect(result).toContain('text-rendering="geometricPrecision"')
  })
})

describe('buildExportHTMLForSheets', () => {
  it('모든 대지를 순서대로 포함한 HTML을 만든다', () => {
    const sheets: TemplateSheetDetail[] = [
      {
        id: 'sheet-1',
        name: '대지 1',
        order: 0,
        width: 260.79,
        height: 147.4,
        unit: 'px',
        widthPx: 260.79,
        heightPx: 147.4,
        svgContent: '<svg><text id="text-a">A</text></svg>',
        fields: [],
      },
      {
        id: 'sheet-2',
        name: '대지 2',
        order: 1,
        width: 260.79,
        height: 147.4,
        unit: 'px',
        widthPx: 260.79,
        heightPx: 147.4,
        svgContent: '<svg><text id="text-b">B</text></svg>',
        fields: [],
      },
    ]

    const html = buildExportHTMLForSheets(sheets, {
      'sheet-1': { 'text-a': { value: '첫 페이지', alignment: 'left', wrapMode: 'preserve' } },
      'sheet-2': { 'text-b': { value: '둘째 페이지', alignment: 'left', wrapMode: 'preserve' } },
    })

    expect(html).toContain('첫 페이지')
    expect(html).toContain('둘째 페이지')
    expect(html.match(/class="page page-/g)).toHaveLength(2)
  })

  it('각 대지에 맞는 페이지 크기와 흰색 배경을 고정한다', () => {
    const sheets: TemplateSheetDetail[] = [
      {
        id: 'sheet-1',
        name: '대지 1',
        order: 0,
        width: 92,
        height: 52,
        unit: 'mm',
        widthPx: 347.72,
        heightPx: 196.54,
        svgContent: '<svg viewBox="0 0 260.79 147.4"><rect width="260.79" height="147.4" fill="none"/></svg>',
        fields: [],
      },
      {
        id: 'sheet-2',
        name: '대지 2',
        order: 1,
        width: 300,
        height: 200,
        unit: 'px',
        widthPx: 300,
        heightPx: 200,
        svgContent: '<svg viewBox="0 0 300 200"><rect width="300" height="200" fill="none"/></svg>',
        fields: [],
      },
    ]

    const html = buildExportHTMLForSheets(sheets, { 'sheet-1': {}, 'sheet-2': {} })

    expect(html).toContain('@page sheet-1 { size: 92mm 52mm; margin: 0; }')
    expect(html).toContain('@page sheet-2 { size: 300px 200px; margin: 0; }')
    expect(html).toContain('.page-1 { page: sheet-1; }')
    expect(html).toContain('.page-2 { page: sheet-2; }')
    expect(html).toContain('background: white;')
    expect(html).toContain('class="sheet-surface"')
  })

  it('저장된 sheet 치수를 우선 사용하고 svg 재파싱 값에 의존하지 않는다', () => {
    const sheets: TemplateSheetDetail[] = [{
      id: 'sheet-1',
      name: '대지 1',
      order: 0,
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
      svgContent: '<svg viewBox="0 0 260.79 147.4"><rect width="260.79" height="147.4" fill="none"/></svg>',
      fields: [],
    }]

    const html = buildExportHTMLForSheets(sheets, { 'sheet-1': {} })

    expect(html).toContain('@page sheet-1 { size: 92mm 52mm; margin: 0; }')
    expect(html).toContain('style="width:347.72px;height:196.54px;"')
  })
})

describe('buildExportHTMLForSheet', () => {
  it('단일 대지 HTML은 css @page 없이 svg surface만 렌더한다', () => {
    const sheet: TemplateSheetDetail = {
      id: 'sheet-1',
      name: '대지 1',
      order: 0,
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
      svgContent: '<svg viewBox="0 0 260.79 147.4"><text id="text-a">A</text></svg>',
      fields: [],
    }

    const html = buildExportHTMLForSheet(sheet, { 'text-a': { value: '첫 페이지', alignment: 'left', wrapMode: 'preserve' } })

    expect(html).toContain('width: 347.72px;')
    expect(html).toContain('height: 196.54px;')
    expect(html).toContain('첫 페이지')
    expect(html).not.toContain('@page')
  })
})

describe('getSheetPdfSizePt', () => {
  it('mm 치수를 pt로 변환한다', () => {
    expect(getSheetPdfSizePt({
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
    })).toEqual({
      widthPt: 260.787,
      heightPt: 147.402,
    })
  })
})

describe('pdf dimension transport', () => {
  it('pt를 puppeteer가 지원하는 inch 단위로 정확히 변환할 수 있다', () => {
    const size = getSheetPdfSizePt({
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
    })

    expect((size.widthPt / 72).toFixed(6)).toBe('3.622042')
    expect((size.heightPt / 72).toFixed(6)).toBe('2.047250')
  })
})

describe('fixPdfPageBoxes', () => {
  it('최종 PDF의 page box를 지정된 pt 값으로 다시 고정한다', async () => {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([612, 792])
    page.setCropBox(0, 0, 612, 792)

    const fixed = await fixPdfPageBoxes(Buffer.from(await pdf.save()), [{
      widthPt: 260.787,
      heightPt: 147.402,
    }])

    const reloaded = await PDFDocument.load(new Uint8Array(fixed), { updateMetadata: false })
    const [fixedPage] = reloaded.getPages()
    const mediaBox = fixedPage.getMediaBox()
    const cropBox = fixedPage.getCropBox()

    expect(mediaBox.width).toBeCloseTo(260.787, 4)
    expect(mediaBox.height).toBeCloseTo(147.402, 4)
    expect(cropBox.width).toBeCloseTo(260.787, 4)
    expect(cropBox.height).toBeCloseTo(147.402, 4)
  })

  it('최종 PDF에 Printed 메타데이터를 기록한다', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage([100, 100])

    const fixed = await fixPdfPageBoxes(Buffer.from(await pdf.save()), [{
      widthPt: 100,
      heightPt: 100,
    }], { title: 'Printed Sample' })

    const reloaded = await PDFDocument.load(new Uint8Array(fixed), { updateMetadata: false })

    expect(reloaded.getTitle()).toBe('Printed Sample')
    expect(reloaded.getCreator()).toBe('Printed')
    expect(reloaded.getProducer()).toBe('Printed PDF Engine')
  })
})

describe('recomposePdfPagesToExactSize', () => {
  it('새 페이지에 exact size로 다시 합성한다', async () => {
    const pdf = await PDFDocument.create()
    const sourcePage = pdf.addPage([261.47, 148.08])
    sourcePage.drawRectangle({ x: 0, y: 0, width: 261.47, height: 148.08 })

    const recomposed = await recomposePdfPagesToExactSize(Buffer.from(await pdf.save()), [{
      widthPt: 260.787,
      heightPt: 147.402,
    }])

    const reloaded = await PDFDocument.load(new Uint8Array(recomposed), { updateMetadata: false })
    const [page] = reloaded.getPages()

    expect(page.getMediaBox().width).toBeCloseTo(260.787, 4)
    expect(page.getMediaBox().height).toBeCloseTo(147.402, 4)
    expect(page.getCropBox().width).toBeCloseTo(260.787, 4)
    expect(page.getCropBox().height).toBeCloseTo(147.402, 4)
  })
})

describe('getRasterExportDimensions', () => {
  it('고해상도 모드에서 4배로 확대한다', () => {
    expect(getRasterExportDimensions(260.79, 147.4, 'high-res')).toEqual({
      width: 1044,
      height: 590,
      scale: 4,
    })
  })

  it('기본 모드에서는 원래 px 크기를 사용한다', () => {
    expect(getRasterExportDimensions(260.79, 147.4, 'default')).toEqual({
      width: 261,
      height: 148,
      scale: 1,
    })
  })

  it('긴 변이 12000px를 넘으면 clamp 한다', () => {
    expect(getRasterExportDimensions(4000, 3000, 'high-res')).toEqual({
      width: 12000,
      height: 9000,
      scale: 4,
    })
  })
})

describe('selectRenderableSheets', () => {
  const sheets = [
    { id: 'sheet-2', order: 1 },
    { id: 'sheet-1', order: 0 },
    { id: 'sheet-3', order: 2 },
  ]

  it('all 선택 시 순서대로 전체 대지를 반환한다', () => {
    expect(selectRenderableSheets(sheets, { selectionMode: 'all' })).toEqual([
      { id: 'sheet-1', order: 0 },
      { id: 'sheet-2', order: 1 },
      { id: 'sheet-3', order: 2 },
    ])
  })

  it('range 선택 시 시작과 끝이 뒤집혀 들어와도 정상 범위를 반환한다', () => {
    expect(selectRenderableSheets(sheets, {
      selectionMode: 'range',
      rangeStart: 3,
      rangeEnd: 2,
    })).toEqual([
      { id: 'sheet-2', order: 1 },
      { id: 'sheet-3', order: 2 },
    ])
  })

  it('range 선택 시 범위를 벗어난 번호는 대지 개수에 맞게 clamp 한다', () => {
    expect(selectRenderableSheets(sheets, {
      selectionMode: 'range',
      rangeStart: 0,
      rangeEnd: 99,
    })).toEqual([
      { id: 'sheet-1', order: 0 },
      { id: 'sheet-2', order: 1 },
      { id: 'sheet-3', order: 2 },
    ])
  })
})

describe('resolvePdfRenderStrategy', () => {
  it('letterSpacing이 있어도 기본적으로 vector를 유지한다', () => {
    const sheets: TemplateSheetDetail[] = [{
      id: 'sheet-1',
      name: '대지 1',
      order: 0,
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
      svgContent: '<svg><text id="text-a">A</text></svg>',
      fields: [{
        id: 'text-a',
        label: 'text-a',
        defaultValue: 'A',
        sourceType: 'explicit-id',
        alignment: 'left',
        wrapMode: 'preserve',
        order: 0,
        letterSpacing: '0.08em',
      }],
    }]

    expect(resolvePdfRenderStrategy(sheets)).toBe('vector')
  })

  it('stored letter-spacing 메타만 있어도 기본적으로 vector를 유지한다', () => {
    const sheets: TemplateSheetDetail[] = [{
      id: 'sheet-1',
      name: '대지 1',
      order: 0,
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
      svgContent: '<svg><text id="text-a" data-printed-letter-spacing="0.08em">A</text></svg>',
      fields: [{
        id: 'text-a',
        label: 'text-a',
        defaultValue: 'A',
        sourceType: 'explicit-id',
        alignment: 'left',
        wrapMode: 'preserve',
        order: 0,
        letterSpacing: null,
      }],
    }]

    expect(resolvePdfRenderStrategy(sheets)).toBe('vector')
  })

  it('지원되지 않는 SVG effect가 있으면 raster-fidelity를 선택한다', () => {
    const sheets: TemplateSheetDetail[] = [{
      id: 'sheet-1',
      name: '대지 1',
      order: 0,
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
      svgContent: '<svg><defs><filter id="shadow"></filter></defs><rect filter="url(#shadow)" width="10" height="10"/></svg>',
      fields: [{
        id: 'text-a',
        label: 'text-a',
        defaultValue: 'A',
        sourceType: 'explicit-id',
        alignment: 'left',
        wrapMode: 'preserve',
        order: 0,
        letterSpacing: null,
      }],
    }]

    expect(resolvePdfRenderStrategy(sheets)).toBe('raster-fidelity')
  })
})
