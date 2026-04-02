import { reconcileProjectSheetSnapshotDimensions, type ProjectSheetSnapshot, type TemplateSheetDetail } from '@/lib/template-model'

describe('reconcileProjectSheetSnapshotDimensions', () => {
  it('sourceTemplateSheetId가 매칭되면 치수만 template 값으로 교정한다', () => {
    const snapshot: ProjectSheetSnapshot[] = [{
      id: 'project-sheet-1',
      sourceTemplateSheetId: 'template-sheet-1',
      name: '앞면',
      order: 0,
      svgContent: '<svg />',
      fields: [],
      width: 260.79,
      height: 147.4,
      unit: 'px',
      widthPx: 260.79,
      heightPx: 147.4,
    }]

    const templateSheets: TemplateSheetDetail[] = [{
      id: 'template-sheet-1',
      name: '앞면',
      order: 0,
      svgContent: '<svg />',
      fields: [],
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
    }]

    expect(reconcileProjectSheetSnapshotDimensions(snapshot, templateSheets)).toEqual([{
      ...snapshot[0],
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
    }])
  })

  it('sourceTemplateSheetId가 없으면 project-local 치수를 유지한다', () => {
    const snapshot: ProjectSheetSnapshot[] = [{
      id: 'project-sheet-1',
      sourceTemplateSheetId: null,
      name: '복사본',
      order: 0,
      svgContent: '<svg />',
      fields: [],
      width: 260.79,
      height: 147.4,
      unit: 'px',
      widthPx: 260.79,
      heightPx: 147.4,
    }]

    const templateSheets: TemplateSheetDetail[] = [{
      id: 'template-sheet-1',
      name: '앞면',
      order: 0,
      svgContent: '<svg />',
      fields: [],
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
    }]

    expect(reconcileProjectSheetSnapshotDimensions(snapshot, templateSheets)).toEqual(snapshot)
  })
})
