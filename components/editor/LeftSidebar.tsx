'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { TemplateEditDialog } from '@/components/editor/TemplateEditDialog'
import { TemplateUploadDialog } from '@/components/editor/TemplateUploadDialog'
import type { TemplateListItem } from '@/lib/template-model'

interface LeftSidebarProps {
  canManageTemplates: boolean
  error?: string | null
  isLoading?: boolean
  onDeleteTemplate?: (templateId: string) => void | Promise<void>
  onEditTemplate?: (
    templateId: string,
    payload: { name: string; category: string; sheets: Array<{ id: string; name: string; order: number }> }
  ) => void | Promise<void>
  templates: TemplateListItem[]
  selectedTemplateId: string | null
  onSelect: (templateId: string) => void
  onUploaded: (templateId: string) => void | Promise<void>
  onRetry?: () => void | Promise<void>
}

function categoryIcon(category: string) {
  const map: Record<string, string> = {
    명함: '🪪', 서류봉투: '✉️', 레터헤드: '📄', 브로셔: '📋', 스티커: '🏷️',
  }
  return map[category] ?? '📎'
}

export function LeftSidebar({
  canManageTemplates,
  error = null,
  isLoading = false,
  onDeleteTemplate,
  onEditTemplate,
  templates,
  selectedTemplateId,
  onSelect,
  onUploaded,
  onRetry,
}: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TemplateListItem | null>(null)
  const [isTemplateSaving, setIsTemplateSaving] = useState(false)
  const [templateActionError, setTemplateActionError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const categories = useMemo(
    () => [...new Set(templates.map(template => template.category))].sort((a, b) => a.localeCompare(b, 'ko')),
    [templates],
  )

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setOpenCategories(current => {
      const next: Record<string, boolean> = {}
      categories.forEach(category => {
        next[category] = current[category] ?? true
      })
      return next
    })
  }, [categories])

  const selectedCategory = useMemo(() => {
    return templates.find(template => template.id === selectedTemplateId)?.category ?? null
  }, [selectedTemplateId, templates])

  const toggleCategory = (category: string) => {
    setOpenCategories(current => ({
      ...current,
      [category]: !(current[category] ?? true),
    }))
  }

  const handleTemplateDelete = async (templateId: string) => {
    if (!onDeleteTemplate) return
    setDeleteConfirmId(templateId)
  }

  const confirmDelete = async () => {
    if (!onDeleteTemplate || !deleteConfirmId) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    setDeleteError(null)
    setTemplateActionError(null)
    try {
      await onDeleteTemplate(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : '템플릿을 삭제하지 못했습니다.'
      setTemplateActionError(message)
      setDeleteError(message)
    }
  }

  return (
    <TooltipProvider delay={0}>
      <>
        <aside className={cn('motion-panel-in motion-sidebar-shell relative flex flex-col border-r bg-card', collapsed ? 'w-16' : 'w-64')}>
          <div className="flex h-14 items-center justify-between border-b px-4">
            {!collapsed ? <p className="motion-sidebar-content text-sm font-semibold text-foreground">템플릿 목록</p> : <span className="sr-only">템플릿 목록</span>}
            <button
              onClick={() => setCollapsed(current => !current)}
              className="editor-press motion-floating rounded-md p-1.5 hover:bg-accent"
              aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <ScrollArea className="min-h-0 flex-1 pb-24">
            {isLoading && templates.length === 0 ? (
              <div className="space-y-3 p-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="rounded-lg border border-border/60 bg-background/75 px-3 py-3">
                    <div className="editor-skeleton h-3 w-16 rounded-full" />
                    <div className="editor-skeleton mt-3 h-4 w-4/5 rounded-md" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-3">
                <div className="border border-destructive/20 bg-destructive/5 px-3 py-3">
                  <p className="text-sm font-medium text-foreground">목록을 불러오지 못했습니다.</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
                  {onRetry ? (
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => void onRetry()}>
                      <RefreshCw size={14} className="mr-1" />
                      다시 시도
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : categories.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">등록된 템플릿이 없습니다.</div>
            ) : (
              <div>
                {categories.map(category => {
                  const categoryTemplates = templates.filter(template => template.category === category)
                  const isOpen = selectedCategory === category ? true : (openCategories[category] ?? true)
                  return (
                    <div key={category} className="border-b last:border-b-0">
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger
                            type="button"
                            onClick={() => toggleCategory(category)}
                            className="editor-press motion-floating flex w-full items-center justify-center px-2 py-3 text-lg hover:bg-accent"
                            aria-label={`${category} 접기 펼치기`}
                          >
                            <span>{categoryIcon(category)}</span>
                          </TooltipTrigger>
                          <TooltipContent side="right">{category}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="editor-press motion-floating flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/40"
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">{category}</span>
                          <ChevronDown size={14} className={cn('text-muted-foreground transition-transform duration-[400ms] [transition-timing-function:var(--motion-bounce-soft)]', isOpen ? 'rotate-0' : '-rotate-90')} />
                        </button>
                      )}

                      {isOpen ? (
                        <div>
                          {categoryTemplates.map(template => {
                            const isActive = selectedTemplateId === template.id
                            if (collapsed) {
                              return (
                                <Tooltip key={template.id}>
                                  <TooltipTrigger
                                    type="button"
                                    onClick={() => onSelect(template.id)}
                                    className={cn(
                                      'editor-hover-lift editor-press relative flex w-full items-center justify-center px-0 py-3 transition-colors',
                                      isActive ? 'bg-primary/6 text-primary' : 'hover:bg-accent/60 text-foreground',
                                    )}
                                    aria-label={template.name}
                                  >
                                    {isActive ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" /> : null}
                                    <span
                                      aria-hidden="true"
                                      className={cn(
                                        'inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold tracking-tight',
                                        isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-background text-foreground/80',
                                      )}
                                    >
                                      {template.name.slice(0, 1)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right">{template.name}</TooltipContent>
                                </Tooltip>
                              )
                            }

                            const row = (
                                <div
                                  className={cn(
                                  'motion-surface group/template relative flex items-center',
                                  isActive ? 'bg-primary/6' : 'hover:bg-accent/60',
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => onSelect(template.id)}
                                  aria-label={collapsed ? template.name : undefined}
                                  className={cn(
                                    'editor-hover-lift editor-press relative flex min-w-0 flex-1 items-center px-4 py-3 text-left transition-colors',
                                    collapsed ? 'justify-center px-0' : '',
                                  )}
                                >
                                  {isActive ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" /> : null}
                                  {!collapsed ? (
                                    <span
                                      className={cn(
                                        'truncate text-sm tracking-tight',
                                        isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground/92',
                                      )}
                                    >
                                      {template.name}
                                    </span>
                                  ) : null}
                                </button>

                                {!collapsed && canManageTemplates ? (
                                  <div className="mr-2 flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/template:opacity-100 md:group-focus-within/template:opacity-100">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        setTemplateActionError(null)
                                        setEditingTemplate(template)
                                      }}
                                      className="editor-press flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground"
                                      aria-label={`${template.name} 수정`}
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void handleTemplateDelete(template.id)
                                      }}
                                      className="editor-press flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                                      aria-label={`${template.name} 삭제`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            )

                            return (
                              <div key={template.id}>
                                {row}
                                <div className="border-t" />
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>

          {canManageTemplates ? (
            <div className="absolute inset-x-0 bottom-0 border-t bg-card/96 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                aria-label={collapsed ? '템플릿 추가' : undefined}
                className={cn(
                  'editor-hover-lift editor-press motion-floating flex w-full items-center gap-3 transition-colors hover:bg-accent/70',
                  collapsed ? 'justify-center px-0 py-4' : 'px-4 py-4 text-left',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Plus size={16} />
                </span>
                {!collapsed ? (
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">템플릿 추가</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">여러 SVG를 한 템플릿으로 등록</span>
                  </span>
                ) : null}
              </button>
            </div>
          ) : null}
        </aside>

        {deleteConfirmId ? (
          <div className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="motion-modal-sheet motion-modal-card w-full max-w-md rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]">
              <div className="border-b px-6 py-5">
                <p className="text-lg font-semibold tracking-tight text-foreground">템플릿 삭제</p>
                <p className="mt-1 text-sm text-muted-foreground">이 템플릿을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-5">
                <Button type="button" variant="outline" className="editor-press" onClick={() => setDeleteConfirmId(null)}>취소</Button>
                <Button type="button" variant="destructive" className="editor-press" onClick={() => void confirmDelete()}>삭제</Button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteError ? (
          <div className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="motion-modal-sheet motion-modal-card w-full max-w-md rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]">
              <div className="border-b px-6 py-5">
                <p className="text-lg font-semibold tracking-tight text-foreground">삭제 실패</p>
                <p className="mt-1 text-sm text-muted-foreground">{deleteError}</p>
              </div>
              <div className="flex justify-end border-t px-6 py-5">
                <Button type="button" variant="outline" className="editor-press" onClick={() => setDeleteError(null)}>확인</Button>
              </div>
            </div>
          </div>
        ) : null}

        <TemplateUploadDialog open={isUploadOpen} onOpenChange={setIsUploadOpen} onUploaded={onUploaded} />
        <TemplateEditDialog
          error={templateActionError}
          isOpen={Boolean(editingTemplate)}
          isSaving={isTemplateSaving}
          template={editingTemplate}
          onClose={() => {
            setEditingTemplate(null)
            setTemplateActionError(null)
          }}
          onConfirm={async (payload) => {
            if (!editingTemplate || !onEditTemplate) return
            setIsTemplateSaving(true)
            setTemplateActionError(null)
            try {
              await onEditTemplate(editingTemplate.id, payload)
              setEditingTemplate(null)
            } catch (error) {
              setTemplateActionError(error instanceof Error ? error.message : '템플릿을 수정하지 못했습니다.')
            } finally {
              setIsTemplateSaving(false)
            }
          }}
        />
      </>
    </TooltipProvider>
  )
}
