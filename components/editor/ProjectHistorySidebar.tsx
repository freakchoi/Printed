'use client'

import { useMemo } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProjectSummary } from '@/lib/template-model'

interface ProjectHistorySidebarProps {
  activeProjectId: string | null
  error?: string | null
  isDirty: boolean
  isAdmin?: boolean
  isLoading?: boolean
  onRetry?: () => void
  projects: ProjectSummary[]
  selectedTemplateName?: string | null
  onCreateProject: () => void
  onDeleteProject?: (projectId: string) => void
  onDuplicateProject: (projectId: string) => void
  onOpenProject: (projectId: string) => void
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ProjectHistorySidebar({
  activeProjectId,
  error = null,
  isDirty,
  isAdmin = false,
  isLoading = false,
  onRetry,
  projects,
  selectedTemplateName,
  onCreateProject,
  onDeleteProject,
  onDuplicateProject,
  onOpenProject,
}: ProjectHistorySidebarProps) {
  const orderedProjects = useMemo(
    () => [...projects].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [projects],
  )

  return (
    <aside className="motion-panel-in motion-surface flex h-full w-64 shrink-0 flex-col border-r bg-[var(--editor-history)] backdrop-blur-sm">
      <div className="flex h-14 items-center border-b px-4">
        <p className="truncate text-sm font-semibold text-foreground">{selectedTemplateName ?? '템플릿 선택 전'}</p>
      </div>

      <button
        type="button"
        onClick={onCreateProject}
        className="editor-hover-lift editor-press motion-floating flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/60"
      >
        <Plus size={14} className="text-primary" />
        <span className="text-sm font-medium text-foreground">만들기</span>
      </button>
      <div className="border-t" />

      <div className="min-h-0 flex-1 overflow-auto">
        {error ? (
          <div className="border-b border-destructive/20 bg-destructive/6 px-4 py-3">
            <p className="text-xs font-medium text-foreground">작업 이력을 불러오지 못했습니다.</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{error}</p>
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" className="editor-press mt-2 h-8" onClick={onRetry}>
                다시 시도
              </Button>
            ) : null}
          </div>
        ) : null}
        {isLoading && orderedProjects.length === 0 ? (
          <div className="space-y-3 px-4 py-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                <div className="editor-skeleton h-4 w-3/4 rounded-md" />
                <div className="editor-skeleton mt-2 h-3 w-20 rounded-md" />
              </div>
            ))}
          </div>
        ) : orderedProjects.length === 0 ? (
          <div className="px-4 py-5 text-sm text-muted-foreground">저장된 작업 파일이 없습니다.</div>
        ) : (
          <div className="motion-stagger">
            {orderedProjects.map(project => {
            const isActive = activeProjectId === project.id
            const secondaryText = project.lastExportedAt && project.lastExportedByActorName
              ? `내보내기 ${project.lastExportedByActorName} · ${formatUpdatedAt(project.lastExportedAt)}`
              : project.lastEditedByActorName
                ? `최근 저장 ${project.lastEditedByActorName}`
                : formatUpdatedAt(project.updatedAt)
            return (
              <div key={project.id} className="motion-surface group relative">
                <button
                  type="button"
                  onClick={() => onOpenProject(project.id)}
                  className={cn(
                    'editor-hover-lift editor-press block w-full px-4 py-3 pr-20 text-left transition-colors',
                    isActive ? 'bg-primary/6' : 'hover:bg-accent/60',
                  )}
                >
                  {isActive ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" /> : null}
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
                    {isActive && isDirty ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{secondaryText}</p>
                </button>
                <div className={cn(
                  'motion-floating absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5',
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                )}>
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation()
                      onDuplicateProject(project.id)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground focus-visible:outline-none"
                    aria-label="이 작업 복제"
                    title="이 작업 복제"
                  >
                    <Copy size={13} />
                  </button>
                  {isAdmin && onDeleteProject ? (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        onDeleteProject(project.id)
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive focus-visible:outline-none"
                      aria-label="이 작업 삭제"
                      title="이 작업 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
                <div className="border-t" />
              </div>
            )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
