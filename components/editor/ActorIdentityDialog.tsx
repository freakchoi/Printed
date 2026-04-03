'use client'

import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ActorIdentityDialogProps {
  draftName: string
  error?: string | null
  isOpen: boolean
  isRequired?: boolean
  onClose: () => void
  onConfirm: () => void
  onDraftNameChange: (value: string) => void
}

export function ActorIdentityDialog({
  draftName,
  error = null,
  isOpen,
  isRequired = false,
  onClose,
  onConfirm,
  onDraftNameChange,
}: ActorIdentityDialogProps) {
  if (!isOpen) return null

  return (
    <div className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="motion-modal-sheet motion-modal-card w-full max-w-md rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]">
        <div className="border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound size={18} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">작업자 이름 설정</p>
              <p className="mt-1 text-sm text-muted-foreground">공용 계정에서도 누가 저장하고 내보냈는지 기록합니다.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">작업자 이름</label>
            <Input
              autoFocus
              className="h-10 rounded-md px-3 py-2"
              placeholder="예: 민지 / 디자인팀"
              value={draftName}
              onChange={(event) => onDraftNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onConfirm()
              }}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              이 이름은 현재 브라우저에 저장되며, 같은 공용 계정에서도 작업 이력 구분에만 사용됩니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-5">
          {!isRequired ? (
            <Button type="button" variant="outline" onClick={onClose}>
              닫기
            </Button>
          ) : null}
          <Button type="button" disabled={!draftName.trim()} onClick={onConfirm}>
            저장
          </Button>
        </div>
      </div>
    </div>
  )
}
