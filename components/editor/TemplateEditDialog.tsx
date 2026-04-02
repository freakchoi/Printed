'use client'

import { useEffect, useState } from 'react'
import { GripVertical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TemplateListItem } from '@/lib/template-model'

type TemplateEditPayload = {
  name: string
  category: string
  sheets: Array<{ id: string; name: string; order: number }>
}

interface TemplateEditDialogProps {
  error?: string | null
  isOpen: boolean
  isSaving: boolean
  template: TemplateListItem | null
  onClose: () => void
  onConfirm: (payload: TemplateEditPayload) => void | Promise<void>
}

function reorderSheets(
  items: Array<{ id: string; name: string; order: number }>,
  draggingId: string,
  targetId: string,
) {
  if (draggingId === targetId) return items

  const sourceIndex = items.findIndex(item => item.id === draggingId)
  const targetIndex = items.findIndex(item => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return items

  const next = [...items]
  const [draggingItem] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, draggingItem)

  return next.map((item, index) => ({
    ...item,
    order: index,
  }))
}

export function TemplateEditDialog({
  error = null,
  isOpen,
  isSaving,
  template,
  onClose,
  onConfirm,
}: TemplateEditDialogProps) {
  const roomyInputClass = 'h-10 rounded-md px-3 py-2'
  const modalSectionClass = 'rounded-lg border border-border/70 bg-muted/15 px-4 py-4'
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [editableSheets, setEditableSheets] = useState<Array<{ id: string; name: string; order: number }>>([])
  const [draggingSheetId, setDraggingSheetId] = useState<string | null>(null)
  const [dragOverSheetId, setDragOverSheetId] = useState<string | null>(null)

  useEffect(() => {
    if (!template || !isOpen) return
    setName(template.name)
    setCategory(template.category)
    setEditableSheets(
      [...template.sheets]
        .sort((a, b) => a.order - b.order)
        .map((sheet, index) => ({
          id: sheet.id,
          name: sheet.name,
          order: index,
        })),
    )
    setDraggingSheetId(null)
    setDragOverSheetId(null)
  }, [isOpen, template])

  if (!isOpen || !template) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]">
        <div className="border-b px-6 py-5">
          <p className="text-lg font-semibold tracking-tight text-foreground">템플릿 수정</p>
          <p className="mt-1 text-sm text-muted-foreground">템플릿명, 분류, 대지명을 조정할 수 있습니다.</p>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className={modalSectionClass}>
            <label className="text-sm font-medium text-foreground">템플릿명</label>
            <Input
              className={`mt-2 ${roomyInputClass}`}
              autoFocus
              disabled={isSaving}
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </div>

          <div className={modalSectionClass}>
            <label className="text-sm font-medium text-foreground">분류</label>
            <Input
              className={`mt-2 ${roomyInputClass}`}
              disabled={isSaving}
              value={category}
              onChange={event => setCategory(event.target.value)}
            />
          </div>

          <div className={modalSectionClass}>
            <div>
              <p className="text-sm font-medium text-foreground">대지명</p>
              <p className="mt-1 text-xs text-muted-foreground">드래그로 순서를 바꾸고, 각 대지 이름도 함께 수정할 수 있습니다.</p>
            </div>
            <div className="mt-3 space-y-2">
              {editableSheets.map((sheet, index) => (
                <div
                  key={sheet.id}
                  className={cn(
                    'flex items-start gap-3 rounded-md border border-border/70 bg-background px-3 py-3 transition-[border-color,background-color,opacity]',
                    draggingSheetId === sheet.id ? 'opacity-60' : '',
                    dragOverSheetId === sheet.id ? 'border-primary bg-primary/5' : '',
                  )}
                  onDragOver={(event) => {
                    if (!draggingSheetId || isSaving) return
                    event.preventDefault()
                    if (dragOverSheetId !== sheet.id) {
                      setDragOverSheetId(sheet.id)
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (!draggingSheetId || isSaving) return
                    setEditableSheets(current => reorderSheets(current, draggingSheetId, sheet.id))
                    setDraggingSheetId(null)
                    setDragOverSheetId(null)
                  }}
                >
                  {editableSheets.length > 1 ? (
                    <button
                      type="button"
                      draggable={!isSaving}
                      aria-label={`${sheet.name} 순서 변경`}
                      className="mt-5 flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-accent/40 hover:text-foreground active:cursor-grabbing"
                      onDragStart={(event) => {
                        if (isSaving) {
                          event.preventDefault()
                          return
                        }
                        setDraggingSheetId(sheet.id)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', sheet.id)
                      }}
                      onDragEnd={() => {
                        setDraggingSheetId(null)
                        setDragOverSheetId(null)
                      }}
                    >
                      <GripVertical size={16} />
                    </button>
                  ) : (
                    <div className="w-10 shrink-0" aria-hidden="true" />
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <label className="block text-xs font-medium text-muted-foreground">{`대지 ${index + 1}`}</label>
                    <Input
                      className={roomyInputClass}
                      disabled={isSaving}
                      value={sheet.name}
                      onChange={event => setEditableSheets(current => current.map(item => (
                        item.id === sheet.id ? { ...item, name: event.target.value } : item
                      )))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-5">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            취소
          </Button>
          <Button
            type="button"
            disabled={isSaving || !name.trim() || !category.trim() || editableSheets.some(sheet => !sheet.name.trim())}
            onClick={() => void onConfirm({
              name: name.trim(),
              category: category.trim(),
              sheets: editableSheets.map((sheet, index) => ({
                id: sheet.id,
                name: sheet.name.trim(),
                order: index,
              })),
            })}
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" />
                저장 중...
              </>
            ) : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
