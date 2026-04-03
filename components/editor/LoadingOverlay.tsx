'use client'

import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingOverlayProps {
  className?: string
  description?: string | null
  isVisible: boolean
  title: string
}

export function LoadingOverlay({ className, description = null, isVisible, title }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div className={cn('motion-backdrop absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[2px]', className)}>
      <div className="motion-modal-sheet motion-modal-card rounded-xl border border-border/70 bg-background/95 px-5 py-4 shadow-[0_20px_45px_rgba(15,23,42,0.14)]">
        <div className="flex items-center gap-3">
          <LoaderCircle size={18} className="animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
