'use client'

import { Button } from '@/components/ui/button'

interface ConfirmDiscardDialogProps {
  isOpen: boolean
  onCancel: () => void
  onDiscard: () => void
  onSaveFirst: () => void
}

export function ConfirmDiscardDialog({ isOpen, onCancel, onDiscard, onSaveFirst }: ConfirmDiscardDialogProps) {
  if (!isOpen) return null

  return (
    <div className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="motion-modal-sheet motion-modal-card w-full max-w-md rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]">
        <div className="border-b px-6 py-5">
          <p className="text-lg font-semibold tracking-tight text-foreground">저장되지 않은 변경사항</p>
          <p className="mt-1 text-sm text-muted-foreground">다른 템플릿이나 파일로 이동하기 전에 현재 작업을 어떻게 처리할지 선택하세요.</p>
        </div>
        <div className="px-6 py-5 text-sm leading-6 text-muted-foreground">
          저장 후 이동은 현재 변경사항을 보존합니다. 저장하지 않고 이동을 선택하면 마지막 저장 이후 작업은 복구할 수 없습니다.
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-5">
          <Button type="button" variant="outline" className="editor-press" onClick={onCancel}>취소</Button>
          <Button type="button" variant="outline" className="editor-press" onClick={onDiscard}>저장하지 않고 이동</Button>
          <Button type="button" className="editor-press" onClick={onSaveFirst}>저장 후 이동</Button>
        </div>
      </div>
    </div>
  )
}
