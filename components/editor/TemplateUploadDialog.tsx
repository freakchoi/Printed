'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FilePlus2, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ADOBE_WORKING_CMYK_PRESETS } from '@/lib/print-color'
import type { AdobeWorkingCmykPreset } from '@/lib/template-model'

interface TemplateUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: (templateId: string, sheetId?: string) => void | Promise<void>
}

function stripSvgExtension(name: string) {
  return name.replace(/\.svg$/i, '')
}

export function TemplateUploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: TemplateUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const roomyInputClass = 'h-10 rounded-md px-3 py-2'
  const sharpSelectClass = 'mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
  const [files, setFiles] = useState<File[]>([])
  const [category, setCategory] = useState('')
  const [name, setName] = useState('')
  const [adobeWorkingCmykPreset, setAdobeWorkingCmykPreset] = useState<AdobeWorkingCmykPreset>('FOGRA39')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFiles([])
      setCategory('')
      setName('')
      setAdobeWorkingCmykPreset('FOGRA39')
      setError(null)
      setIsSubmitting(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [open])

  const fileHint = useMemo(() => {
    if (files.length === 0) return 'SVG 파일만 업로드할 수 있습니다.'
    return `${files.length}개 파일 선택됨: ${files.map(file => file.name).join(', ')}`
  }, [files])

  if (!open) return null

  const validate = () => {
    if (files.length === 0) return 'SVG 파일을 선택해주세요.'
    const invalidFile = files.find(file => file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg'))
    if (invalidFile) return 'SVG 파일만 업로드할 수 있습니다.'
    if (!category.trim()) return '분류를 입력해주세요.'
    if (!name.trim()) return '템플릿명을 입력해주세요.'
    if (!adobeWorkingCmykPreset) return '인쇄용 CMYK 프로파일을 선택해주세요.'
    return null
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? [])
    setFiles(nextFiles)
    setError(null)
    if (nextFiles.length > 0 && !name.trim()) {
      setName(stripSvgExtension(nextFiles[0].name))
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('category', category.trim())
      formData.append('name', name.trim())
      formData.append('printColorProfileMode', 'adobe-working-cmyk')
      formData.append('adobeWorkingCmykPreset', adobeWorkingCmykPreset)

      const res = await fetch('/api/templates', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error ?? '템플릿 업로드에 실패했습니다.')
      }

      await onUploaded(data.id, data.sheets?.[0]?.id)
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '템플릿 업로드에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]">
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div>
            <p className="text-lg font-semibold tracking-tight text-foreground">템플릿 추가</p>
            <p className="mt-1 text-sm text-muted-foreground">여러 SVG 파일을 한 템플릿 묶음으로 등록하고, 업로드 순서대로 대지를 구성합니다.</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-md border border-transparent hover:border-border hover:bg-accent/45" onClick={() => onOpenChange(false)} aria-label="닫기">
            <X size={16} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="template-files">SVG 파일</Label>
            <input
              ref={inputRef}
              id="template-files"
              type="file"
              accept=".svg,image/svg+xml"
              multiple
              className="sr-only"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
            <Button type="button" variant="outline" className="mt-2 w-full justify-start" onClick={() => inputRef.current?.click()} disabled={isSubmitting}>
              <FilePlus2 size={14} className="mr-1" />
              파일 열기
            </Button>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{fileHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-category">분류</Label>
            <Input
              className={roomyInputClass}
              id="template-category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="명함, 브로셔, 소봉투, 대봉투"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-name">템플릿명</Label>
            <Input
              className={roomyInputClass}
              id="template-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="국내용, 해외용, 소봉투, 대봉투"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-print-profile">인쇄용 CMYK 기준</Label>
            <select
              id="template-print-profile"
              value={adobeWorkingCmykPreset}
              onChange={e => setAdobeWorkingCmykPreset(e.target.value as AdobeWorkingCmykPreset)}
              disabled={isSubmitting}
              className={sharpSelectClass}
            >
              {ADOBE_WORKING_CMYK_PRESETS.map(preset => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">원본 문서에서 사용한 Adobe Working CMYK 프로파일과 동일한 기준을 선택하세요.</p>
          </div>

          <div className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">업로드 안내</p>
            <p className="mt-2 leading-6">여러 SVG를 선택하면 한 템플릿 묶음으로 등록되며, 업로드 순서대로 <code>대지 1</code>, <code>대지 2</code> 이름이 부여됩니다.</p>
            <p className="mt-2 leading-6">Illustrator SVG의 <code>{'<text>'}</code>에 id가 없어도 가능한 경우 자동으로 편집 필드로 등록됩니다. 윤곽선 처리된 텍스트는 보기용으로만 남을 수 있습니다.</p>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t pt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="mr-1 animate-spin" />
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload size={14} className="mr-1" />
                  등록
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
