'use client'

import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { makeArtboardDisplayName, makeFieldDisplayName, type FieldAlignment, type ProjectSheetSnapshot, type SheetFieldValue, type TemplateField, type TemplateSheetDetail } from '@/lib/template-model'

interface TextPanelProps {
  selectedField: TemplateField | null
  selectedFieldIndex: number
  selectedSheet: ProjectSheetSnapshot | TemplateSheetDetail | null
  valueState: SheetFieldValue | null
  onAlignmentChange: (alignment: FieldAlignment) => void
  onFieldChange: (value: string) => void
}

export function TextPanel({
  selectedField,
  selectedFieldIndex,
  selectedSheet,
  valueState,
  onAlignmentChange,
  onFieldChange,
}: TextPanelProps) {
  if (!selectedField || !selectedSheet || !valueState) return null

  return (
    <aside className="flex h-full w-80 min-h-0 shrink-0 translate-x-0 flex-col bg-transparent opacity-100 transition-[opacity,transform] duration-150 ease-out">
      <div className="flex h-14 items-center border-b px-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">텍스트 인스펙터</p>
          <p className="mt-1 text-sm font-medium text-foreground">{makeFieldDisplayName(selectedFieldIndex)}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-card">
        <div className="px-4 py-4">
          <p className="text-xs font-medium text-muted-foreground">{makeArtboardDisplayName(selectedSheet.order, selectedSheet.name)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedField.sourceType === 'generated-id' ? 'Illustrator 텍스트 자동 인식' : 'SVG 텍스트 필드'}
          </p>
        </div>
        <div className="border-t" />

        <section className="px-4 py-4">
          <p className="text-xs font-medium text-muted-foreground">텍스트</p>
          <textarea
            value={valueState.value}
            onChange={event => onFieldChange(event.target.value)}
            className="mt-3 min-h-40 w-full rounded-xl border border-input bg-transparent px-3 py-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </section>
        <div className="border-t" />

        <section className="px-4 py-4">
          <p className="text-xs font-medium text-muted-foreground">정렬</p>
          <div className="mt-3 inline-flex rounded-xl border border-border bg-muted/40 p-1">
            {([
              ['left', AlignLeft, '좌측 정렬'],
              ['center', AlignCenter, '가운데 정렬'],
              ['right', AlignRight, '우측 정렬'],
            ] as const).map(([alignment, Icon, label]) => (
              <button
                key={alignment}
                type="button"
                aria-label={label}
                onClick={() => onAlignmentChange(alignment)}
                className={valueState.alignment === alignment
                  ? 'rounded-lg bg-background px-3 py-2 text-foreground shadow-sm transition-colors'
                  : 'rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground'}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
