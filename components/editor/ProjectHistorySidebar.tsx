'use client'

import { useMemo } from 'react'
import { Copy, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectSummary } from '@/lib/template-model'

interface ProjectHistorySidebarProps {
  activeProjectId: string | null
  isDirty: boolean
  projects: ProjectSummary[]
  selectedTemplateName?: string | null
  onCreateProject: () => void
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
  isDirty,
  projects,
  selectedTemplateName,
  onCreateProject,
  onDuplicateProject,
  onOpenProject,
}: ProjectHistorySidebarProps) {
  const orderedProjects = useMemo(
    () => [...projects].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [projects],
  )

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-[var(--editor-history)] backdrop-blur-sm">
      <div className="flex h-14 items-center border-b px-4">
        <p className="truncate text-sm font-semibold text-foreground">{selectedTemplateName ?? '템플릿 선택 전'}</p>
      </div>

      <button
        type="button"
        onClick={onCreateProject}
        className="flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/60"
      >
        <Plus size={14} className="text-primary" />
        <span className="text-sm font-medium text-foreground">만들기</span>
      </button>
      <div className="border-t" />

      <div className="min-h-0 flex-1 overflow-auto">
        {orderedProjects.length === 0 ? (
          <div className="px-4 py-5 text-sm text-muted-foreground">저장된 작업 파일이 없습니다.</div>
        ) : (
          orderedProjects.map(project => {
            const isActive = activeProjectId === project.id
            return (
              <div key={project.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpenProject(project.id)}
                  className={cn(
                    'block w-full px-4 py-3 pr-12 text-left transition-colors',
                    isActive ? 'bg-primary/6' : 'hover:bg-accent/60',
                  )}
                >
                  {isActive ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" /> : null}
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
                    {isActive && isDirty ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatUpdatedAt(project.updatedAt)}</p>
                </button>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    onDuplicateProject(project.id)
                  }}
                  className={cn(
                    'absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground focus-visible:outline-none',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                  )}
                  aria-label="이 작업 복제"
                  title="이 작업 복제"
                >
                  <Copy size={14} />
                </button>
                <div className="border-t" />
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
