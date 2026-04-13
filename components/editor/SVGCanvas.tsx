'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { AlertCircle, Copy, Download, GripVertical, LoaderCircle, PencilLine, Plus, Save, Trash2, X } from 'lucide-react'
import { LoadingOverlay } from '@/components/editor/LoadingOverlay'
import { ZoomControl } from '@/components/editor/ZoomControl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatSheetDimensions, makeArtboardDisplayName, type ProjectSheetSnapshot, type ProjectValuesBySheet, type TemplateSheetDetail } from '@/lib/template-model'
import { applyFieldValuesToSVG } from '@/lib/svg-parser'
import { cn } from '@/lib/utils'

type DocumentFootprint = {
  height: number
  totalStageHeight: number
  width: number
  widestStageWidth: number
}

type SelectedFieldBox = {
  left: number
  top: number
  width: number
  height: number
}

interface SVGCanvasProps {
  activeSheetId?: string | null
  error?: string | null
  fitRequestKey?: number
  isEditingProjectName?: boolean
  isExporting?: boolean
  isLoading?: boolean
  isSaving?: boolean
  mode: 'template-preview' | 'project-preview'
  onCommitProjectName?: () => void
  onCancelProjectNameEdit?: () => void
  onCreateProject?: () => void
  onDeleteProject?: () => void
  onDuplicateProject?: () => void
  onDeleteSelectedSheets?: (sheetId?: string) => void
  onOpenExport?: () => void
  onOpenSave?: () => void
  onProjectNameChange?: (value: string) => void
  onMoveSelectedSheets?: (targetSheetId: string, position: 'before' | 'after') => void
  onRenameSheet?: (sheetId: string, name: string) => void | Promise<void>
  onSelectField?: (sheetId: string, fieldId: string) => void
  onSelectSheet?: (sheetId: string, options?: { shiftKey?: boolean; metaKey?: boolean; source?: 'shell' | 'field' }) => void
  onStartProjectNameEdit?: () => void
  pendingProjectName?: string
  selectedFieldId?: string | null
  selectedSheetIds?: string[]
  sheets: Array<ProjectSheetSnapshot | TemplateSheetDetail>
  templateName?: string
  timestampLabel?: string | null
  timestampValue?: string | null
  title: string
  valuesBySheet: ProjectValuesBySheet
  zoomLabel: string
  maxZoomScale: number
  zoomPreset: 'fit' | 'manual'
  zoomScale: number
  onFitScaleCalculated?: (scale: number) => void
  onMaxZoomCalculated?: (scale: number) => void
  onZoomFit?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomSet?: (scale: number) => void
  onZoomWheel?: (delta: number) => void
}

function enhanceResponsiveSVG(svg: string) {
  return svg.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
    const cleaned = attrs.replace(/\s(?:width|height|style|preserveAspectRatio)="[^"]*"/g, '')
    return `<svg${cleaned} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;max-width:100%;overflow:visible;">`
  })
}

function measureSelectedFieldBox({
  stage,
  textNode,
}: {
  stage: HTMLElement
  textNode: SVGGraphicsElement
}): SelectedFieldBox | null {
  const textRect = textNode.getBoundingClientRect()
  const stageRect = stage.getBoundingClientRect()

  if ((!textRect.width && !textRect.height) || !stageRect.width || !stageRect.height) return null

  return {
    left: Math.max(0, textRect.left - stageRect.left - 6),
    top: Math.max(0, textRect.top - stageRect.top - 4),
    width: Math.max(24, textRect.width + 12),
    height: Math.max(20, textRect.height + 8),
  }
}

function computeDocumentFootprint(
  sheets: TemplateSheetDetail[],
  chrome: { boardPadding: number; gap: number; horizontal: number; vertical: number },
): DocumentFootprint {
  const widestStageWidth = Math.max(...sheets.map(sheet => sheet.widthPx))
  const totalStageHeight = sheets.reduce((sum, sheet) => sum + sheet.heightPx, 0)

  return {
    widestStageWidth,
    totalStageHeight,
    width: widestStageWidth + chrome.horizontal,
    height:
      totalStageHeight +
      (chrome.gap * Math.max(0, sheets.length - 1)) +
      (chrome.vertical * sheets.length) +
      (chrome.boardPadding * 2),
  }
}

function computeFitScale(args: {
  footprint: DocumentFootprint
  viewportHeight: number
  viewportWidth: number
}) {
  const fitByWidth = args.viewportWidth / args.footprint.width
  const fitByHeight = args.viewportHeight / args.footprint.height
  return Math.min(fitByWidth, fitByHeight)
}

function computeDynamicMaxZoom(args: {
  shellHorizontalChrome: number
  viewportWidth: number
  widestSheetWidth: number
}) {
  return Math.min(
    8,
    Math.max(
      1,
      ((args.viewportWidth - args.shellHorizontalChrome) / args.widestSheetWidth) * 1.25,
    ),
  )
}

const BOARD_PADDING = 24
const HORIZONTAL_CHROME = 32
const VERTICAL_CHROME = 76
const DOCUMENT_GAP = 32

export function SVGCanvas({
  activeSheetId = null,
  error = null,
  isEditingProjectName = false,
  isExporting = false,
  isLoading = false,
  isSaving = false,
  mode,
  onCommitProjectName,
  onCancelProjectNameEdit,
  onCreateProject,
  onDeleteProject,
  onDuplicateProject,
  onDeleteSelectedSheets,
  onOpenExport,
  onOpenSave,
  onProjectNameChange,
  onMoveSelectedSheets,
  onRenameSheet,
  onSelectField,
  onSelectSheet,
  onStartProjectNameEdit,
  pendingProjectName = '',
  selectedFieldId = null,
  selectedSheetIds = [],
  sheets,
  templateName,
  timestampLabel = null,
  timestampValue = null,
  title,
  valuesBySheet,
  zoomLabel,
  maxZoomScale,
  zoomPreset,
  zoomScale,
  fitRequestKey = 0,
  onFitScaleCalculated,
  onMaxZoomCalculated,
  onZoomFit,
  onZoomIn,
  onZoomOut,
  onZoomSet,
  onZoomWheel,
}: SVGCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isProjectPreview = mode === 'project-preview'
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null)
  const [editingSheetName, setEditingSheetName] = useState('')
  const [editingSheetOriginalName, setEditingSheetOriginalName] = useState('')
  const [dragTarget, setDragTarget] = useState<{ sheetId: string; position: 'before' | 'after' } | null>(null)
  const [draggingSheetId, setDraggingSheetId] = useState<string | null>(null)
  const [selectedFieldBox, setSelectedFieldBox] = useState<SelectedFieldBox | null>(null)
  const activeStageObserverRef = useRef<ResizeObserver | null>(null)
  const measurementFrameRef = useRef<number | null>(null)
  const sheetRenderCacheRef = useRef(new Map<string, string>())
  const effectiveZoomScale = Math.min(maxZoomScale, Math.max(0.1, zoomScale))
  const floatingHeaderDensity = effectiveZoomScale < 0.4 ? 'compact-2' : effectiveZoomScale < 0.6 ? 'compact-1' : 'default'
  const sharpIconButtonClass = 'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
  const sharpDividerClass = 'h-5 w-px bg-border/80'

  const renderedSheets = useMemo(() => {
    return sheets.map(sheet => {
      const sheetValues = valuesBySheet[sheet.id] ?? {}
      const cacheKey = `${sheet.id}:${JSON.stringify(sheetValues)}`
      const cached = sheetRenderCacheRef.current.get(cacheKey)
      if (cached) return { ...sheet, markup: cached }

      const sanitized = DOMPurify.sanitize(applyFieldValuesToSVG(sheet.svgContent, sheetValues), {
        USE_PROFILES: { svg: true },
        FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onfocus', 'onblur'],
      })
      const markup = /<svg\b/i.test(sanitized) ? enhanceResponsiveSVG(sanitized) : ''
      if (process.env.NODE_ENV !== 'production' && !markup) {
        console.warn('[SVGCanvas] Empty sheet markup after sanitize', sheet.id)
      }

      sheetRenderCacheRef.current.set(cacheKey, markup)
      if (sheetRenderCacheRef.current.size > 50) {
        const firstKey = sheetRenderCacheRef.current.keys().next().value
        if (firstKey !== undefined) sheetRenderCacheRef.current.delete(firstKey)
      }

      return {
        ...sheet,
        markup,
      }
    })
  }, [sheets, valuesBySheet])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const preventGestureZoom = (event: Event) => {
      event.preventDefault()
    }

    node.addEventListener('gesturestart', preventGestureZoom, { passive: false })
    node.addEventListener('gesturechange', preventGestureZoom, { passive: false })
    node.addEventListener('gestureend', preventGestureZoom, { passive: false })

    return () => {
      node.removeEventListener('gesturestart', preventGestureZoom)
      node.removeEventListener('gesturechange', preventGestureZoom)
      node.removeEventListener('gestureend', preventGestureZoom)
    }
  }, [])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const textElements = root.querySelectorAll<SVGTextElement>('text[id]')
    textElements.forEach(element => {
      const fieldId = element.getAttribute('id')
      const sheetRoot = element.closest<HTMLElement>('[data-sheet-id]')
      const sheetId = sheetRoot?.dataset.sheetId
      if (!fieldId || !sheetId) return

      const isSelected = isProjectPreview && selectedFieldId === fieldId && activeSheetId === sheetId
      element.style.cursor = isProjectPreview ? 'pointer' : 'default'
      element.style.transition = 'opacity 140ms ease'
      element.style.paintOrder = ''
      element.style.strokeLinejoin = ''
      element.style.strokeLinecap = ''
      element.style.stroke = 'transparent'
      element.style.strokeWidth = '0'
      element.style.filter = 'none'
      element.style.opacity = isSelected ? '1' : ''
    })

    if (!isProjectPreview) return

    const handleEnter = (e: Event) => {
      const textEl = (e.target as Element).closest?.('text[id]')
      if (!textEl) return
      const fieldId = textEl.getAttribute('id')
      const sheetRoot = textEl.closest<HTMLElement>('[data-sheet-id]')
      const sheetId = sheetRoot?.dataset.sheetId
      if (selectedFieldId === fieldId && activeSheetId === sheetId) return
      ;(textEl as HTMLElement).style.opacity = '0.92'
    }
    const handleLeave = (e: Event) => {
      const textEl = (e.target as Element).closest?.('text[id]')
      if (!textEl) return
      const fieldId = textEl.getAttribute('id')
      const sheetRoot = textEl.closest<HTMLElement>('[data-sheet-id]')
      const sheetId = sheetRoot?.dataset.sheetId
      if (selectedFieldId === fieldId && activeSheetId === sheetId) return
      ;(textEl as HTMLElement).style.opacity = ''
    }

    root.addEventListener('mouseenter', handleEnter, true)
    root.addEventListener('mouseleave', handleLeave, true)

    return () => {
      root.removeEventListener('mouseenter', handleEnter, true)
      root.removeEventListener('mouseleave', handleLeave, true)
    }
  }, [activeSheetId, isProjectPreview, renderedSheets, selectedFieldId])

  useEffect(() => {
    const root = containerRef.current
    if (!root || !selectedFieldId || !activeSheetId || !isProjectPreview) {
      setSelectedFieldBox(null)
      return
    }

    const scheduleMeasurement = () => {
      if (measurementFrameRef.current !== null) {
        cancelAnimationFrame(measurementFrameRef.current)
      }
      measurementFrameRef.current = requestAnimationFrame(() => {
        const sheetRoot = root.querySelector<HTMLElement>(`[data-sheet-id="${CSS.escape(activeSheetId ?? '')}"]`)
        const stage = root.querySelector<HTMLElement>(`[data-stage-sheet-id="${CSS.escape(activeSheetId ?? '')}"]`)
        const textNode = sheetRoot?.querySelector<SVGGraphicsElement>(`text[id="${CSS.escape(selectedFieldId ?? '')}"]`)

        if (!stage || !textNode) {
          setSelectedFieldBox(null)
          return
        }

        try {
          setSelectedFieldBox(measureSelectedFieldBox({ stage, textNode }))
        } catch {
          setSelectedFieldBox(null)
        }
      })
    }

    scheduleMeasurement()
    const stage = root.querySelector<HTMLElement>(`[data-stage-sheet-id="${CSS.escape(activeSheetId ?? '')}"]`)
    if (stage) {
      activeStageObserverRef.current?.disconnect()
      const observer = new ResizeObserver(() => scheduleMeasurement())
      observer.observe(stage)
      activeStageObserverRef.current = observer
    }

    window.addEventListener('resize', scheduleMeasurement)
    return () => {
      window.removeEventListener('resize', scheduleMeasurement)
      activeStageObserverRef.current?.disconnect()
      activeStageObserverRef.current = null
      if (measurementFrameRef.current !== null) {
        cancelAnimationFrame(measurementFrameRef.current)
        measurementFrameRef.current = null
      }
    }
  }, [activeSheetId, isProjectPreview, renderedSheets, selectedFieldId, effectiveZoomScale])

  useEffect(() => {
    const viewport = containerRef.current
    if (!viewport || !renderedSheets.length) return

    const computeMetrics = () => {
      const viewportWidth = Math.max(1, viewport.clientWidth)
      const viewportHeight = Math.max(1, viewport.clientHeight)
      const usableWidth = Math.max(1, viewportWidth - (BOARD_PADDING * 2))
      const footprint = computeDocumentFootprint(renderedSheets, {
        boardPadding: BOARD_PADDING,
        gap: DOCUMENT_GAP,
        horizontal: HORIZONTAL_CHROME,
        vertical: VERTICAL_CHROME,
      })
      const dynamicMaxZoom = computeDynamicMaxZoom({
        viewportWidth: usableWidth,
        widestSheetWidth: footprint.widestStageWidth,
        shellHorizontalChrome: HORIZONTAL_CHROME,
      })
      onMaxZoomCalculated?.(Number(dynamicMaxZoom.toFixed(3)))
      if (zoomPreset !== 'fit') return
      const nextScale = Math.min(
        dynamicMaxZoom,
        Math.max(
          0.1,
          computeFitScale({
            footprint,
            viewportHeight,
            viewportWidth,
          }),
        ),
      )
      onFitScaleCalculated?.(Number(nextScale.toFixed(3)))
    }

    computeMetrics()
    const observer = new ResizeObserver(computeMetrics)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [BOARD_PADDING, DOCUMENT_GAP, HORIZONTAL_CHROME, VERTICAL_CHROME, fitRequestKey, onFitScaleCalculated, onMaxZoomCalculated, renderedSheets, zoomPreset])

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const isZoomGesture = event.ctrlKey || event.metaKey
    if (!isZoomGesture) return
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      return
    }
    event.preventDefault()
    onZoomWheel?.(event.deltaY > 0 ? -0.05 : 0.05)
  }

  const commitRename = async (sheetId: string) => {
    if (!onRenameSheet) return
    const trimmed = editingSheetName.trim()
    if (!trimmed) {
      setEditingSheetId(null)
      return
    }
    await onRenameSheet(sheetId, trimmed)
    setEditingSheetId(null)
    setEditingSheetOriginalName('')
  }

  const cancelRename = () => {
    setEditingSheetName(editingSheetOriginalName)
    setEditingSheetOriginalName('')
    setEditingSheetId(null)
  }

  if (isLoading && renderedSheets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/25 p-10">
        <div className="motion-fade-up flex w-full max-w-4xl flex-col items-center gap-3 border border-dashed border-border bg-card/85 p-10 text-center">
          <LoaderCircle size={24} className="animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">템플릿 문서를 준비하는 중입니다.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/25 p-10">
        <div className="motion-fade-up w-full max-w-4xl border border-destructive/20 bg-card p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle size={20} />
          </div>
          <p className="text-sm font-medium text-foreground">미리보기를 표시할 수 없습니다.</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="motion-fade-in motion-surface flex h-full min-h-0 min-w-0 flex-col bg-[var(--editor-workspace)]">
      <div className="motion-surface border-b bg-card/95 px-5 py-3 backdrop-blur-sm">
        <div className="flex min-h-12 items-center justify-between gap-4">
          {isProjectPreview ? (
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                {isEditingProjectName ? (
                  <Input
                    autoFocus
                    value={pendingProjectName}
                    onChange={event => onProjectNameChange?.(event.target.value)}
                    onBlur={onCommitProjectName}
                    onKeyDown={event => {
                      if (event.key === 'Enter') onCommitProjectName?.()
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        onCancelProjectNameEdit?.()
                      }
                    }}
                    className="h-8 min-w-[180px] max-w-[320px] rounded-none !border-0 !bg-transparent px-0 py-0 text-sm font-semibold tracking-tight text-foreground shadow-none focus-visible:!border-transparent focus-visible:!ring-0 dark:!bg-transparent"
                  />
                ) : (
                  <>
                    <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h2>
                    <button
                      type="button"
                      onClick={onStartProjectNameEdit}
                      className={cn(sharpIconButtonClass, 'editor-press')}
                      aria-label="작업 이름 수정"
                    >
                      <PencilLine size={14} />
                    </button>
                  </>
                )}
              </div>
              {timestampLabel && timestampValue ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{timestampLabel} {timestampValue}</p>
              ) : null}
            </div>
          ) : (
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">{templateName ?? title}</h2>
          )}

          <div className="flex items-center gap-3">
            {isProjectPreview ? (
              <div className="inline-flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="editor-press h-8 rounded-md" onClick={onOpenSave} disabled={isSaving}>
                  <Save size={14} className="mr-1" />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
                {onDuplicateProject && (
                  <Button size="sm" variant="ghost" className="editor-press h-8 w-8 rounded-md p-0" onClick={onDuplicateProject} disabled={isSaving} title="복제 (다른 이름으로 저장)">
                    <Copy size={14} />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="editor-press h-8 rounded-md" onClick={onOpenExport} disabled={isExporting}>
                  <Download size={14} className="mr-1" />
                  {isExporting ? '내보내는 중...' : '내보내기'}
                </Button>
              </div>
            ) : (
              <Button size="sm" className="editor-press h-8 rounded-md" onClick={onCreateProject}>
                <Plus size={14} className="mr-1" />
                만들기
              </Button>
            )}
            {isProjectPreview ? (
              <>
                <div className={sharpDividerClass} />
                <div className="inline-flex items-center">
                  <Button size="sm" variant="outline" className="editor-press h-8 rounded-md border-destructive/30 text-destructive hover:bg-destructive/8 hover:text-destructive" onClick={onDeleteProject}>
                    <Trash2 size={14} className="mr-1" />
                    삭제
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute right-4 top-4 z-10">
          <ZoomControl
            maxZoomScale={maxZoomScale}
            zoomScale={zoomScale}
            zoomLabel={zoomLabel}
            onZoomFit={onZoomFit ?? (() => {})}
            onZoomIn={onZoomIn ?? (() => {})}
            onZoomOut={onZoomOut ?? (() => {})}
            onZoomSet={onZoomSet ?? (() => {})}
          />
        </div>
        <div
          ref={containerRef}
          className="h-full overflow-auto scroll-smooth"
          onWheel={handleWheel}
        >
        <LoadingOverlay
          isVisible={isSaving || isExporting}
          title={isSaving ? '작업을 저장하는 중' : '파일을 준비하는 중'}
          description={isSaving ? '현재 변경사항을 안전하게 기록하고 있습니다.' : '저장 후 내보내기를 이어서 처리하고 있습니다.'}
        />
        <div className="mx-auto flex min-h-full w-full flex-col items-center gap-8 py-8">
            {isLoading && renderedSheets.length > 0 ? (
              renderedSheets.map((sheet) => {
                const stageW = Math.round(sheet.widthPx * effectiveZoomScale)
                const stageH = Math.round(sheet.heightPx * effectiveZoomScale)
                return (
                  <section
                    key={sheet.id}
                    className="relative mx-auto w-fit border border-border/40 bg-[var(--editor-artboard-shell)] px-3 pb-3 pt-6 sm:px-4 sm:pb-4"
                    style={{ boxShadow: 'var(--editor-artboard-shadow)' }}
                  >
                    <div className="animate-pulse rounded-sm bg-muted/40" style={{ width: stageW, height: stageH }}>
                      <div className="flex h-full flex-col items-center justify-center gap-3">
                        <LoaderCircle size={20} className="animate-spin text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground/60">불러오는 중</span>
                      </div>
                    </div>
                  </section>
                )
              })
            ) : renderedSheets.map((sheet, index) => {
              const isActive = sheet.id === activeSheetId
              const isMultiSelected = selectedSheetIds.includes(sheet.id)
              const isEditing = editingSheetId === sheet.id
              const stageWidth = Math.round(sheet.widthPx * effectiveZoomScale)
              const stageHeight = Math.round(sheet.heightPx * effectiveZoomScale)
              const isCompactHeader = floatingHeaderDensity !== 'default'
              const isUltraCompactHeader = floatingHeaderDensity === 'compact-2'
              return (
                <section
                  key={sheet.id}
                  data-sheet-id={sheet.id}
                  className={cn(
                    'motion-zoom-shell relative mx-auto w-fit border px-3 pb-3 pt-6 sm:px-4 sm:pb-4',
                    'bg-[var(--editor-artboard-shell)]',
                    isActive
                      ? 'border-primary/45 ring-1 ring-primary/20'
                      : isMultiSelected
                        ? 'border-primary/28 ring-1 ring-primary/10'
                        : 'border-[var(--editor-artboard-border)]',
                  )}
                  style={{ boxShadow: 'var(--editor-artboard-shadow)' }}
                  onClickCapture={event => {
                    const target = event.target as Element | null
                    const field = target?.closest('text[id]')
                    const source = field ? 'field' : 'shell'
                    onSelectSheet?.(sheet.id, {
                      shiftKey: event.shiftKey,
                      metaKey: event.metaKey || event.ctrlKey,
                      source,
                    })
                    if (!field || !isProjectPreview) return
                    const fieldId = field.getAttribute('id')
                    if (fieldId) {
                      onSelectField?.(sheet.id, fieldId)
                    }
                  }}
                  onDragOver={event => {
                    if (!draggingSheetId || !isProjectPreview) return
                    event.preventDefault()
                    const bounds = event.currentTarget.getBoundingClientRect()
                    const position = event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before'
                    setDragTarget({ sheetId: sheet.id, position })
                  }}
                  onDrop={event => {
                    if (!draggingSheetId || !dragTarget || !isProjectPreview) return
                    event.preventDefault()
                    onMoveSelectedSheets?.(dragTarget.sheetId, dragTarget.position)
                    setDragTarget(null)
                    setDraggingSheetId(null)
                  }}
                  onDragEnd={() => {
                    setDragTarget(null)
                    setDraggingSheetId(null)
                  }}
                >
                  {dragTarget?.sheetId === sheet.id ? (
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-x-4 z-20 h-0 border-t-2 border-primary',
                        dragTarget.position === 'before' ? 'top-2' : 'bottom-2',
                      )}
                    />
                  ) : null}
                  <div
                    className={cn(
                    'motion-floating absolute left-3 top-0 z-10 flex -translate-y-1/2 items-center rounded-md border shadow-[0_10px_22px_rgba(15,23,42,0.12)] sm:left-4',
                    isUltraCompactHeader ? 'gap-1.5 px-2 py-1.5' : isCompactHeader ? 'gap-2 px-3 py-1.5' : 'gap-3 px-4 py-2',
                    isActive
                      ? 'border-primary/30 bg-card text-foreground'
                      : isMultiSelected
                        ? 'border-primary/20 bg-card text-foreground'
                        : 'border-black/5 bg-card text-foreground',
                  )}
                    style={isUltraCompactHeader ? { maxWidth: `${Math.max(120, Math.min(stageWidth - 24, 240))}px` } : undefined}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="min-w-0">
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={editingSheetName}
                          onChange={event => setEditingSheetName(event.target.value)}
                          onBlur={() => void commitRename(sheet.id)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') void commitRename(sheet.id)
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              cancelRename()
                            }
                          }}
                          className={cn(
                              'w-full rounded-none !border-0 !bg-transparent px-0 py-0 font-semibold tracking-tight text-foreground shadow-none focus-visible:!border-transparent focus-visible:!ring-0 dark:!bg-transparent',
                            isUltraCompactHeader ? 'h-5 min-w-[96px] text-[11px]' : isCompactHeader ? 'h-5 min-w-[120px] text-xs' : 'h-6 min-w-[156px] text-sm',
                          )}
                        />
                      ) : (
                        <>
                          <p className={cn(
                            'truncate whitespace-nowrap font-semibold tracking-tight text-foreground',
                            isUltraCompactHeader ? 'text-[11px]' : isCompactHeader ? 'text-xs' : 'text-sm',
                          )}>
                            {makeArtboardDisplayName(index, sheet.name)}
                          </p>
                          {!isCompactHeader ? (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{formatSheetDimensions(sheet.width, sheet.height, sheet.unit)}</p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <div className={cn('shrink-0 flex items-center', isUltraCompactHeader ? 'gap-0.5' : 'gap-1')}>
                      {isProjectPreview ? (
                        <button
                          type="button"
                          draggable
                          onDragStart={() => {
                            setDraggingSheetId(sheet.id)
                            if (!selectedSheetIds.includes(sheet.id)) {
                              onSelectSheet?.(sheet.id, { source: 'shell' })
                            }
                          }}
                          className={cn(sharpIconButtonClass, 'h-7 w-7 p-0')}
                          aria-label="대지 순서 변경"
                        >
                          <GripVertical size={isUltraCompactHeader ? 12 : 14} />
                        </button>
                      ) : null}
                      {isProjectPreview ? (
                        <button
                          type="button"
                          className={cn(sharpIconButtonClass, 'h-7 w-7 p-0 hover:text-destructive')}
                          onClick={event => {
                            event.stopPropagation()
                            onDeleteSelectedSheets?.(sheet.id)
                          }}
                          aria-label={selectedSheetIds.includes(sheet.id) && selectedSheetIds.length > 1 ? '선택한 대지 삭제' : '대지 삭제'}
                        >
                          <Trash2 size={isUltraCompactHeader ? 12 : 14} />
                        </button>
                      ) : null}
                      {isEditing ? (
                        <button
                          type="button"
                          className={cn(sharpIconButtonClass, 'h-7 w-7 p-0')}
                          onClick={cancelRename}
                          aria-label="대지명 편집 취소"
                        >
                          <X size={isUltraCompactHeader ? 12 : 14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={cn(sharpIconButtonClass, 'h-7 w-7 p-0')}
                          onClick={() => {
                            setEditingSheetId(sheet.id)
                            setEditingSheetName(sheet.name)
                            setEditingSheetOriginalName(sheet.name)
                          }}
                          aria-label="대지명 수정"
                        >
                          <PencilLine size={isUltraCompactHeader ? 12 : 14} />
                        </button>
                      )}
                    </div>
                    </div>
                  </div>

                  {sheet.markup ? (
                    <div className="sheet-surface mx-auto mt-4 flex items-center justify-center">
                      <div
                        className="motion-zoom-surface relative overflow-hidden bg-white"
                        data-stage-sheet-id={sheet.id}
                        style={{ width: `${stageWidth}px`, height: `${stageHeight}px` }}
                      >
                        <div data-stage-svg-host dangerouslySetInnerHTML={{ __html: sheet.markup }} />
                        <div className="pointer-events-none absolute inset-0">
                          {selectedFieldBox && isActive && selectedFieldId ? (
                            <div
                              className="motion-zoom-surface absolute rounded-lg border border-primary/50 bg-primary/10 shadow-[0_8px_20px_rgba(13,111,252,0.08)]"
                              style={{
                                left: `${selectedFieldBox.left}px`,
                                top: `${selectedFieldBox.top}px`,
                                width: `${selectedFieldBox.width}px`,
                                height: `${selectedFieldBox.height}px`,
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                      이 대지의 SVG를 렌더하지 못했습니다.
                    </div>
                  )}
                </section>
              )
            })}
        </div>
        </div>
      </div>
    </div>
  )
}
