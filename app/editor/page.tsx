'use client'
import { useEffect, useState, useCallback } from 'react'
import { LeftSidebar } from '@/components/editor/LeftSidebar'
import { SVGCanvas } from '@/components/editor/SVGCanvas'
import { TextPanel } from '@/components/editor/TextPanel'
import { ThemeToggle } from '@/components/ThemeToggle'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface Template {
  id: string
  name: string
  category: string
  thumbnail?: string | null
  variants?: Template[]
}

interface TemplateDetail extends Template {
  fields: { id: string; label: string; defaultValue: string }[]
  svgContent: string
}

export default function EditorPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName] = useState('새 프로젝트')
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(setTemplates)
  }, [])

  useEffect(() => {
    if (!selectedTemplateId) return
    fetch(`/api/templates/${selectedTemplateId}`)
      .then(r => r.json())
      .then((detail: TemplateDetail) => {
        setTemplateDetail(detail)
        const defaults: Record<string, string> = {}
        detail.fields.forEach(f => { defaults[f.id] = f.defaultValue })
        setValues(defaults)
        setProjectId(null)
      })
  }, [selectedTemplateId])

  const handleFieldChange = useCallback((id: string, value: string) => {
    setValues(prev => ({ ...prev, [id]: value }))
  }, [])

  const handleSave = async () => {
    if (!templateDetail) return
    setIsSaving(true)
    try {
      if (projectId) {
        await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName, values }),
        })
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName, templateId: templateDetail.id, values }),
        })
        const project = await res.json()
        setProjectId(project.id)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'png' | 'jpeg') => {
    if (isExporting) return
    setIsExporting(true)
    try {
      let currentProjectId = projectId
      if (!currentProjectId) {
        if (!templateDetail) return
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName, templateId: templateDetail.id, values }),
        })
        const project = await res.json()
        currentProjectId = project.id
        setProjectId(project.id)
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProjectId, format }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 h-12 border-b bg-card shrink-0">
        <span className="font-semibold text-sm tracking-tight">Printed</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="로그아웃">
            <LogOut size={16} />
          </Button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          templates={templates}
          selectedId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
        />
        {templateDetail ? (
          <>
            <SVGCanvas svgContent={templateDetail.svgContent} values={values} />
            <TextPanel
              fields={templateDetail.fields}
              values={values}
              projectName={projectName}
              isSaving={isSaving}
              isExporting={isExporting}
              onFieldChange={handleFieldChange}
              onSave={handleSave}
              onExport={handleExport}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            좌측에서 템플릿을 선택해주세요
          </div>
        )}
      </div>
    </div>
  )
}
