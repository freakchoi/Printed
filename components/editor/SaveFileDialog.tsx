'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SaveFileDialogProps {
  error?: string | null
  fileName: string
  isOpen: boolean
  isSaving: boolean
  isInitialSave?: boolean
  onClose: () => void
  onConfirm: () => void
  onFileNameChange: (nextName: string) => void
}

export function SaveFileDialog({
  error = null,
  fileName,
  isOpen,
  isSaving,
  isInitialSave = false,
  onClose,
  onConfirm,
  onFileNameChange,
}: SaveFileDialogProps) {
  if (!isOpen) return null
  const roomyInputClass = 'h-10 rounded-md px-3 py-2'

  return (
    <div className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="motion-modal-sheet motion-modal-card w-full max-w-md rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]">
        <div className="border-b px-6 py-5">
          <p className="text-lg font-semibold tracking-tight text-foreground">파일 저장</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isInitialSave
              ? '새 작업 파일로 저장합니다.'
              : '현재 작업 이름을 확인한 뒤 저장합니다.'}
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">파일 이름</label>
            <Input
              className={roomyInputClass}
              autoFocus
              value={fileName}
              onChange={event => onFileNameChange(event.target.value)}
              placeholder="파일 이름을 입력하세요"
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-5">
          <Button type="button" variant="outline" className="editor-press" onClick={onClose}>
            취소
          </Button>
          <Button type="button" className="editor-press" disabled={isSaving || !fileName.trim()} onClick={onConfirm}>
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
