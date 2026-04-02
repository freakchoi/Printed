'use client'

import { useEffect, useRef } from 'react'
import { AlignCenter, AlignLeft, AlignRight, X } from 'lucide-react'
import type { FieldAlignment, ProjectSheetSnapshot, SheetFieldValue, TemplateField, TemplateSheetDetail } from '@/lib/template-model'

interface FieldToastEditorProps {
  selectedField: TemplateField | null
  selectedFieldIndex: number
  selectedSheet: ProjectSheetSnapshot | TemplateSheetDetail | null
  valueState: SheetFieldValue | null
  onAlignmentChange: (alignment: FieldAlignment) => void
  onClose: () => void
  onFieldChange: (value: string) => void
}

export function FieldToastEditor({
  selectedField,
  selectedFieldIndex: _selectedFieldIndex,
  selectedSheet,
  valueState,
  onAlignmentChange,
  onClose,
  onFieldChange,
}: FieldToastEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lastFocusKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!selectedField || !selectedSheet || !valueState) return

    const focusKey = `${selectedSheet.id}:${selectedField.id}`
    if (lastFocusKeyRef.current === focusKey) return
    lastFocusKeyRef.current = focusKey

    const frameId = window.requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(0, textarea.value.length)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [selectedField?.id, selectedSheet?.id, valueState])

  if (!selectedField || !selectedSheet || !valueState) return null

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(560px,calc(100%-32px))] -translate-x-1/2">
      <div className="pointer-events-auto rounded-lg border border-border/80 bg-card/96 shadow-[0_18px_40px_rgba(2,8,23,0.18)] backdrop-blur-lg">
        <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">텍스트 수정</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{selectedSheet.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="편집기 닫기"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_auto] md:items-start">
          <textarea
            ref={textareaRef}
            autoFocus
            value={valueState.value}
            onChange={event => onFieldChange(event.target.value)}
            className="min-h-28 w-full resize-none rounded-md border border-input bg-background/85 px-3 py-3 text-sm leading-6 outline-none transition-colors focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring/10"
          />

          <div className="flex items-center gap-2 md:flex-col md:items-stretch">
            <p className="sr-only">정렬</p>
            <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
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
                    ? 'rounded-sm bg-background px-3 py-2 text-foreground shadow-sm transition-colors'
                    : 'rounded-sm px-3 py-2 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground'}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
