'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ZoomControlProps {
  maxZoomScale: number
  zoomScale: number
  zoomLabel: string
  onZoomFit: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomSet: (scale: number) => void
}

export function ZoomControl({
  maxZoomScale,
  zoomScale,
  zoomLabel,
  onZoomFit,
  onZoomIn,
  onZoomOut,
  onZoomSet,
}: ZoomControlProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [showSlider, setShowSlider] = useState(false)
  const dragStartX = useRef(0)
  const dragStartZoom = useRef(1)
  const didDrag = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartZoom.current = zoomScale
    didDrag.current = false
    setIsDragging(true)

    const handleMouseMove = (ev: MouseEvent) => {
      const dist = ev.clientX - dragStartX.current
      if (Math.abs(dist) > 3) didDrag.current = true
      const delta = dist * 0.005
      const next = Math.min(maxZoomScale, Math.max(0.1, dragStartZoom.current + delta))
      onZoomSet(next)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      if (!didDrag.current) setShowSlider(prev => !prev)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  useEffect(() => {
    if (!showSlider) return
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setShowSlider(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSlider])

  const sliderPercent = ((zoomScale - 0.1) / (maxZoomScale - 0.1)) * 100

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-0.5 rounded-xl border border-border bg-background/96 px-2 py-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-sm dark:shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
        <button
          type="button"
          onClick={onZoomOut}
          disabled={zoomScale <= 0.101}
          className="editor-press flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="축소"
        >
          <Minus size={13} />
        </button>

        <button
          type="button"
          onMouseDown={handleDragStart}
          className={cn(
            'min-w-[52px] rounded-lg px-2 py-1 text-xs font-medium text-foreground transition-colors select-none',
            isDragging ? 'cursor-ew-resize bg-accent/60' : 'cursor-ew-resize hover:bg-accent/60',
          )}
          aria-label="배율 조정 — 드래그하거나 클릭해 슬라이더 열기"
          title="드래그로 배율 조정 / 클릭 시 슬라이더"
        >
          {zoomLabel}
        </button>

        <button
          type="button"
          onClick={onZoomIn}
          disabled={zoomScale >= maxZoomScale - 0.001}
          className="editor-press flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="확대"
        >
          <Plus size={13} />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          onClick={onZoomFit}
          className="editor-press rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          맞춤
        </button>
      </div>

      {showSlider ? (
        <div className="absolute right-0 top-[calc(100%+8px)] flex w-52 flex-col gap-2 rounded-xl border border-border bg-background/96 px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-sm dark:shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">배율</span>
            <span className="text-[11px] font-medium text-foreground">{zoomLabel}</span>
          </div>
          <input
            type="range"
            min={10}
            max={Math.round(maxZoomScale * 100)}
            step={5}
            value={Math.round(zoomScale * 100)}
            onChange={e => onZoomSet(Number(e.target.value) / 100)}
            style={{
              background: `linear-gradient(to right, hsl(var(--foreground)) ${sliderPercent}%, hsl(var(--border)) ${sliderPercent}%)`,
            }}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-sm"
            aria-label="배율 슬라이더"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onZoomSet(0.1)}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              10%
            </button>
            <button
              type="button"
              onClick={onZoomFit}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              맞춤
            </button>
            <button
              type="button"
              onClick={() => onZoomSet(maxZoomScale)}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              최대
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
