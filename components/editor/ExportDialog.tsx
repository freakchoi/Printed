'use client'

import { useEffect, useRef } from 'react'
import { FileStack, FileText, Image as ImageIconLucide, ImageIcon, Layers3, ScanSearch, StretchHorizontal, StretchVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CombinedImageDirection, ImageOutputMode, ImageSelectionMode } from '@/lib/template-model'
import type { RasterMode } from '@/lib/export'

interface ExportDialogProps {
  combinedDirection: CombinedImageDirection
  fileName: string
  format: 'pdf' | 'png' | 'jpeg'
  imageMode: ImageOutputMode
  isExporting: boolean
  isOpen: boolean
  outlineText: boolean
  rangeEnd: number
  rangeStart: number
  rasterMode: RasterMode
  selectionMode: ImageSelectionMode
  sheetCount: number
  onClose: () => void
  onConfirm: () => void
  onCombinedDirectionChange: (direction: CombinedImageDirection) => void
  onFileNameChange: (value: string) => void
  onFormatChange: (format: 'pdf' | 'png' | 'jpeg') => void
  onImageModeChange: (mode: ImageOutputMode) => void
  onOutlineTextChange: (value: boolean) => void
  onRangeEndChange: (value: number) => void
  onRangeStartChange: (value: number) => void
  onRasterModeChange: (mode: RasterMode) => void
  onSelectionModeChange: (mode: ImageSelectionMode) => void
}

export function ExportDialog({
  combinedDirection,
  fileName,
  format,
  imageMode,
  isExporting,
  isOpen,
  outlineText,
  rangeEnd,
  rangeStart,
  rasterMode,
  selectionMode,
  sheetCount,
  onClose,
  onConfirm,
  onCombinedDirectionChange,
  onFileNameChange,
  onFormatChange,
  onImageModeChange,
  onOutlineTextChange,
  onRangeEndChange,
  onRangeStartChange,
  onRasterModeChange,
  onSelectionModeChange,
}: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return
    const first = dialogRef.current.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled])'
    )
    first?.focus()
  }, [isOpen])

  if (!isOpen) return null
  const isConfirmDisabled = isExporting || !fileName.trim()
  const roomyInputClass = 'h-10 rounded-md px-3 py-2'
  const formatCardClass = (isSelected: boolean) => (
    isSelected
      ? 'flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-md border border-primary bg-primary/12 px-3 py-3 text-primary transition-transform transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]'
      : 'flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-3 text-foreground transition-transform transition-colors hover:bg-accent/45 hover:border-border/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]'
  )
  const optionCardClass = (isSelected: boolean) => (
    isSelected
      ? 'flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-md border border-primary bg-primary/12 px-3 py-3 text-primary text-center transition-transform transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]'
      : 'flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-3 text-foreground text-center transition-transform transition-colors hover:bg-accent/45 hover:border-border/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]'
  )
  const formatOptions = [
    { value: 'pdf' as const, label: 'PDF', Icon: FileText },
    { value: 'png' as const, label: 'PNG', Icon: ImageIcon },
    { value: 'jpeg' as const, label: 'JPG', Icon: ImageIconLucide },
  ]
  const selectionOptions = [
    { value: 'all' as const, label: '전체 대지', description: '모든 대지 저장', Icon: Layers3 },
    { value: 'range' as const, label: '범위 선택', description: '시작·끝 번호 지정', Icon: ScanSearch },
  ]
  const imageModeOptions = [
    { value: 'combined' as const, label: '한 장 합본 이미지', description: '여러 대지를 한 파일로', Icon: FileStack },
    { value: 'separate' as const, label: '각 장 개별 저장', description: '대지별로 개별 파일 저장', Icon: Layers3 },
  ]
  const combinedDirectionOptions = [
    { value: 'horizontal' as const, label: '가로 합치기', description: '좌우로 이어 붙이기', Icon: StretchVertical },
    { value: 'vertical' as const, label: '세로 합치기', description: '상하로 이어 붙이기', Icon: StretchHorizontal },
  ]
  const rasterOptions = [
    { value: 'high-res' as const, label: '고해상도', description: '4배 크기로 렌더링' },
    { value: 'default' as const, label: '기본', description: '원본 px 크기 유지' },
  ]

  return (
    <div className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} className="motion-modal-sheet motion-modal-card flex max-h-[calc(100dvh-48px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="border-b px-6 py-5">
          <p className="text-lg font-semibold tracking-tight text-foreground">내보내기</p>
          <p className="mt-1 text-sm text-muted-foreground">파일 이름과 저장 방식을 선택한 뒤 포맷별 옵션을 조정합니다.</p>
        </div>

        <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-2">
            <label className="text-sm font-medium text-foreground">파일 이름</label>
            <Input className={roomyInputClass} value={fileName} onChange={event => onFileNameChange(event.target.value)} placeholder="내보낼 파일 이름" />
            <p className="text-xs leading-5 text-muted-foreground">파일은 이 브라우저의 기본 다운로드 폴더로 저장됩니다.</p>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium text-foreground">저장 방식</p>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="저장 방식">
              {formatOptions.map(({ value, label, Icon }) => {
                const isSelected = format === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={label}
                    onClick={() => onFormatChange(value)}
                    className={formatCardClass(isSelected)}
                  >
                    <Icon size={20} />
                    <span className="text-sm font-medium tracking-tight">{label}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {format === 'pdf' ? (
            <section className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                모든 대지를 번호 순서대로 PDF로 저장합니다. 대지 헤더 UI는 출력물에 포함되지 않습니다.
              </div>
              <button
                type="button"
                role="checkbox"
                aria-checked={outlineText}
                onClick={() => onOutlineTextChange(!outlineText)}
                className={[
                  'flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                  outlineText
                    ? 'border-primary/50 bg-primary/6 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-accent/40',
                ].join(' ')}
              >
                <span className={[
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  outlineText ? 'border-primary bg-primary' : 'border-border bg-background',
                ].join(' ')}>
                  {outlineText && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium">텍스트 벡터화 (윤곽선 변환)</span>
                  <span className="block text-xs leading-5 text-muted-foreground">폰트를 벡터 패스로 변환해 어떤 환경에서도 동일한 폰트로 출력됩니다. 파일 크기가 커질 수 있습니다.</span>
                </span>
              </button>
            </section>
          ) : (
            <>
              <section className="space-y-2">
                <p className="text-sm font-medium text-foreground">대지 선택</p>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="대지 선택">
                  {selectionOptions.map(({ value, label, description, Icon }) => {
                    const isSelected = selectionMode === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={label}
                        onClick={() => onSelectionModeChange(value)}
                        className={optionCardClass(isSelected)}
                      >
                        <Icon size={18} />
                        <span className="text-sm font-medium tracking-tight">{label}</span>
                        <span className="text-[11px] leading-4 opacity-75">{description}</span>
                      </button>
                    )
                  })}
                </div>
                {selectionMode === 'range' ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">시작 번호</label>
                      <Input className={roomyInputClass} type="number" min={1} max={sheetCount} value={rangeStart} onChange={event => onRangeStartChange(Number(event.target.value || 1))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">끝 번호</label>
                      <Input className={roomyInputClass} type="number" min={1} max={sheetCount} value={rangeEnd} onChange={event => onRangeEndChange(Number(event.target.value || 1))} />
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium text-foreground">출력 방식</p>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="출력 방식">
                  {imageModeOptions.map(({ value, label, description, Icon }) => {
                    const isSelected = imageMode === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={label}
                        onClick={() => onImageModeChange(value)}
                        className={optionCardClass(isSelected)}
                      >
                        <Icon size={18} />
                        <span className="text-sm font-medium tracking-tight">{label}</span>
                        <span className="text-[11px] leading-4 opacity-75">{description}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {imageMode === 'combined' ? (
                <section className="space-y-2">
                  <p className="text-sm font-medium text-foreground">합본 방향</p>
                  <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="합본 방향">
                    {combinedDirectionOptions.map(option => {
                      const isSelected = combinedDirection === option.value
                    return (
                      <button
                        key={option.value}
                          type="button"
                          role="radio"
                        aria-checked={isSelected}
                        aria-label={option.label}
                        onClick={() => onCombinedDirectionChange(option.value)}
                        className={formatCardClass(isSelected)}
                      >
                        <span className="inline-flex h-10 w-10 items-center justify-center">
                          <option.Icon size={22} />
                        </span>
                        <span className="text-sm font-medium tracking-tight">{option.label}</span>
                        <span className="text-[11px] leading-4 opacity-75">{option.description}</span>
                      </button>
                    )
                  })}
                  </div>
                </section>
              ) : null}

              <section className="space-y-2">
                <p className="text-sm font-medium text-foreground">해상도</p>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="해상도">
                  {rasterOptions.map(({ value, label, description }) => {
                    const isSelected = rasterMode === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={label}
                        onClick={() => onRasterModeChange(value)}
                        className={optionCardClass(isSelected)}
                      >
                        <span className="text-sm font-medium tracking-tight">{label}</span>
                        <span className="text-[11px] leading-4 opacity-75">{description}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">배경은 흰색으로 고정되며 PNG/JPG 모두 300PPI 메타데이터를 기록합니다.</p>
              </section>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-5">
          <Button type="button" variant="outline" className="editor-press" onClick={onClose}>취소</Button>
          <Button type="button" className="editor-press" disabled={isConfirmDisabled} onClick={onConfirm}>
            {isExporting
              ? `${format === 'pdf' ? 'PDF' : format === 'png' ? 'PNG' : 'JPG'} 생성 중...`
              : `${format === 'pdf' ? 'PDF' : format === 'png' ? 'PNG' : 'JPG'} 저장`}
          </Button>
        </div>
      </div>
    </div>
  )
}
