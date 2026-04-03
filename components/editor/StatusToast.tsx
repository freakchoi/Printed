'use client'

import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusToastProps {
  isVisible: boolean
  kind?: 'error' | 'success'
  message: string
  onDismiss?: () => void
}

export function StatusToast({ isVisible, kind = 'error', message, onDismiss }: StatusToastProps) {
  if (!isVisible) return null

  return (
    <div
      className={cn(
        'motion-modal-sheet motion-modal-card flex min-w-[280px] max-w-[420px] items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_18px_42px_rgba(15,23,42,0.16)] backdrop-blur-sm dark:shadow-[0_18px_42px_rgba(0,0,0,0.38)]',
        kind === 'error'
          ? 'border-destructive/25 bg-destructive text-white'
          : 'border-primary/20 bg-background/96 text-foreground',
      )}
    >
      <div className={cn('mt-0.5 shrink-0', kind === 'error' ? 'text-white/95' : 'text-primary')}>
        {kind === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      </div>
      <p className={cn('flex-1 text-sm leading-6', kind === 'error' ? 'text-white' : 'text-foreground')}>
        {message}
      </p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'mt-0.5 shrink-0 rounded-md p-1 transition-opacity',
            kind === 'error' ? 'text-white/60 hover:text-white/100' : 'text-foreground/60 hover:text-foreground/100',
          )}
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
