import { hydrateProjectSheetSnapshots } from '@/lib/template-server'
import type { ProjectSheetSnapshot } from '@/lib/template-model'

describe('hydrateProjectSheetSnapshots', () => {
  it('old snapshot field 메타가 비어 있어도 svg에서 letterSpacing을 복원한다', () => {
    const snapshots: ProjectSheetSnapshot[] = [{
      id: 'sheet-1',
      sourceTemplateSheetId: 'sheet-1',
      name: '대지 1',
      order: 0,
      svgContent: '<svg><text id="text-name" x="10" y="20" letter-spacing="0.08em">홍길동</text></svg>',
      fields: [{
        id: 'text-name',
        label: 'text-name',
        defaultValue: '홍길동',
        sourceType: 'explicit-id',
        alignment: 'left',
        wrapMode: 'preserve',
        order: 0,
        letterSpacing: null,
        textFrame: null,
      }],
      width: 92,
      height: 52,
      unit: 'mm',
      widthPx: 347.72,
      heightPx: 196.54,
    }]

    const [hydrated] = hydrateProjectSheetSnapshots(snapshots)

    expect(hydrated.fields[0]?.letterSpacing).toBe('0.08em')
    expect(hydrated.svgContent).toContain('data-printed-letter-spacing="0.08em"')
  })
})
