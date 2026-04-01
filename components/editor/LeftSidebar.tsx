'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

interface Template {
  id: string
  name: string
  category: string
  thumbnail?: string | null
  parentId?: string | null
  variants?: Template[]
}

interface LeftSidebarProps {
  templates: Template[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function categoryIcon(category: string) {
  const map: Record<string, string> = {
    명함: '🪪', 서류봉투: '✉️', 레터헤드: '📄', 브로셔: '📋', 스티커: '🏷️',
  }
  return map[category] ?? '📎'
}

function TemplateItem({
  template, selectedId, onSelect, collapsed, depth = 0,
}: {
  template: Template
  selectedId: string | null
  onSelect: (id: string) => void
  collapsed: boolean
  depth?: number
}) {
  const [open, setOpen] = useState(false)
  const hasVariants = template.variants && template.variants.length > 0

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          onClick={() => hasVariants ? setOpen(o => !o) : onSelect(template.id)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md mx-1',
            selectedId === template.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            depth > 0 && 'ml-3 w-[calc(100%-12px)]'
          )}
        >
          <span className="text-base shrink-0">{categoryIcon(template.category)}</span>
          {!collapsed && (
            <>
              <span className="truncate text-left flex-1">{template.name}</span>
              {hasVariants && <span className="text-xs opacity-50">{open ? '▾' : '▸'}</span>}
            </>
          )}
        </TooltipTrigger>
        {collapsed && <TooltipContent side="right">{template.name}</TooltipContent>}
      </Tooltip>
      {open && !collapsed && template.variants?.map(v => (
        <TemplateItem
          key={v.id}
          template={v}
          selectedId={selectedId}
          onSelect={onSelect}
          collapsed={collapsed}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

export function LeftSidebar({ templates, selectedId, onSelect }: LeftSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const rootTemplates = templates.filter(t => !t.parentId)
  const categories = [...new Set(rootTemplates.map(t => t.category))]

  return (
    <TooltipProvider delay={0}>
      <aside className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        collapsed ? 'w-14' : 'w-48'
      )}>
        <div className="flex items-center justify-end p-2 border-b">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded hover:bg-accent"
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <ScrollArea className="flex-1">
          {categories.map(cat => (
            <div key={cat} className="py-2">
              {!collapsed && (
                <p className="px-3 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  {cat}
                </p>
              )}
              {rootTemplates.filter(t => t.category === cat).map(template => (
                <TemplateItem
                  key={template.id}
                  template={template}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  collapsed={collapsed}
                />
              ))}
            </div>
          ))}
        </ScrollArea>
      </aside>
    </TooltipProvider>
  )
}
