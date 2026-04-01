'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Download, Save } from 'lucide-react'

interface Field {
  id: string
  label: string
  defaultValue: string
}

interface TextPanelProps {
  fields: Field[]
  values: Record<string, string>
  projectName: string
  isSaving: boolean
  isExporting: boolean
  onFieldChange: (id: string, value: string) => void
  onSave: () => void
  onExport: (format: 'pdf' | 'png' | 'jpeg') => void
}

export function TextPanel({
  fields, values, projectName, isSaving, isExporting,
  onFieldChange, onSave, onExport,
}: TextPanelProps) {
  return (
    <aside className="w-56 flex flex-col border-l bg-card">
      <div className="p-3 border-b">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">텍스트 수정</p>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {fields.map(field => (
            <div key={field.id} className="space-y-1">
              <Label htmlFor={field.id} className="text-xs capitalize">
                {field.label}
              </Label>
              <Input
                id={field.id}
                value={values[field.id] ?? field.defaultValue}
                onChange={e => onFieldChange(field.id, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-3 space-y-2">
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full"
          size="sm"
        >
          <Save size={14} className="mr-1" />
          {isSaving ? '저장 중...' : '저장'}
        </Button>
        <Button
          onClick={() => onExport('pdf')}
          variant="outline"
          className="w-full"
          size="sm"
          disabled={isExporting}
        >
          <Download size={14} className="mr-1" />
          PDF (CMYK, 인쇄용)
        </Button>
        <Button
          onClick={() => onExport('png')}
          variant="outline"
          className="w-full"
          size="sm"
          disabled={isExporting}
        >
          <Download size={14} className="mr-1" />
          PNG (RGB)
        </Button>
        <Button
          onClick={() => onExport('jpeg')}
          variant="outline"
          className="w-full"
          size="sm"
          disabled={isExporting}
        >
          <Download size={14} className="mr-1" />
          JPG (RGB)
        </Button>
      </div>
    </aside>
  )
}
