'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { LeftSidebar } from '@/components/editor/LeftSidebar'
import { SVGCanvas } from '@/components/editor/SVGCanvas'
import { FieldToastEditor } from '@/components/editor/FieldToastEditor'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ProjectHistorySidebar } from '@/components/editor/ProjectHistorySidebar'
import { SaveFileDialog } from '@/components/editor/SaveFileDialog'
import { ConfirmDiscardDialog } from '@/components/editor/ConfirmDiscardDialog'
import { ExportDialog } from '@/components/editor/ExportDialog'
import {
  type CombinedImageDirection,
  createEmptyValuesForSheets,
  type FieldAlignment,
  type ImageOutputMode,
  type ImageSelectionMode,
  type ProjectSheetSnapshot,
  type ProjectSummary,
  type ProjectValuesBySheet,
  type TemplateDetail,
  type TemplateField,
  type TemplateListItem,
} from '@/lib/template-model'
import type { RasterMode } from '@/lib/export'

function makeSnapshot(fileName: string, values: ProjectValuesBySheet, sheetSnapshot: ProjectSheetSnapshot[] = []) {
  return JSON.stringify({ fileName: fileName.trim(), values, sheetSnapshot })
}

function getDownloadName(headerValue: string | null, fallback: string) {
  if (!headerValue) return fallback
  const encodedMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) return decodeURIComponent(encodedMatch[1])
  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] ?? fallback
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

type ExportFormat = 'pdf' | 'png' | 'jpeg'

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

type ActiveProjectMeta = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

type ZoomPreset = 'fit' | 'manual'

type EditorUndoState = {
  pendingProjectName: string
  projectSheets: ProjectSheetSnapshot[]
  values: ProjectValuesBySheet
}

type PendingAction =
  | { type: 'select-template'; templateId: string }
  | { type: 'open-project'; projectId: string }
  | { type: 'create-project' }
  | { type: 'delete-project'; projectId: string }
  | {
      type: 'export'
      fileName: string
      format: 'pdf' | 'png' | 'jpeg'
      combinedDirection?: CombinedImageDirection
      imageMode?: ImageOutputMode
      selectionMode?: ImageSelectionMode
      rasterMode?: RasterMode
      rangeStart?: number
      rangeEnd?: number
    }

export default function EditorPage() {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null)
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [isTemplateLoading, setIsTemplateLoading] = useState(false)
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeProjectMeta, setActiveProjectMeta] = useState<ActiveProjectMeta | null>(null)
  const [projectTimestampMode, setProjectTimestampMode] = useState<'created' | 'saved'>('saved')
  const [pendingProjectName, setPendingProjectName] = useState('')
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [projectSheets, setProjectSheets] = useState<ProjectSheetSnapshot[]>([])
  const [values, setValues] = useState<ProjectValuesBySheet>({})
  const [baselineSnapshot, setBaselineSnapshot] = useState(makeSnapshot('', {}))
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null)
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>([])
  const [selectionAnchorSheetId, setSelectionAnchorSheetId] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [copiedSheetIds, setCopiedSheetIds] = useState<string[]>([])
  const [undoStack, setUndoStack] = useState<EditorUndoState[]>([])
  const [hasCompletedInitialSave, setHasCompletedInitialSave] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png' | 'jpeg'>('pdf')
  const [exportFileName, setExportFileName] = useState('')
  const [selectionMode, setSelectionMode] = useState<ImageSelectionMode>('all')
  const [imageMode, setImageMode] = useState<ImageOutputMode>('combined')
  const [combinedDirection, setCombinedDirection] = useState<CombinedImageDirection>('horizontal')
  const [rasterMode, setRasterMode] = useState<RasterMode>('high-res')
  const [rangeStart, setRangeStart] = useState(1)
  const [rangeEnd, setRangeEnd] = useState(1)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('fit')
  const [fitRequestKey, setFitRequestKey] = useState(0)
  const [maxZoomScale, setMaxZoomScale] = useState(8)
  const projectsRequestRef = useRef(0)
  const textEditSessionRef = useRef<{ fieldId: string; sheetId: string } | null>(null)
  const cloneProjectSheets = useCallback((sheets: ProjectSheetSnapshot[]) => (
    sheets.map(sheet => ({
      ...sheet,
      fields: sheet.fields.map(field => ({ ...field })),
    }))
  ), [])

  const cloneProjectValues = useCallback((source: ProjectValuesBySheet) => (
    Object.fromEntries(
      Object.entries(source).map(([sheetId, sheetValues]) => [
        sheetId,
        Object.fromEntries(
          Object.entries(sheetValues).map(([fieldId, state]) => [fieldId, { ...state }]),
        ),
      ]),
    )
  ), [])

  const cloneUndoState = useCallback((state: EditorUndoState): EditorUndoState => ({
    pendingProjectName: state.pendingProjectName,
    projectSheets: cloneProjectSheets(state.projectSheets),
    values: cloneProjectValues(state.values),
  }), [cloneProjectSheets, cloneProjectValues])

  const loadTemplates = useCallback(async () => {
    setIsTemplatesLoading(true)
    setTemplatesError(null)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? '템플릿 목록을 불러오지 못했습니다.')
      }
      const data = await res.json() as TemplateListItem[]
      setTemplates(data)
    } catch (error) {
      setTemplatesError(error instanceof Error ? error.message : '템플릿 목록을 불러오지 못했습니다.')
    } finally {
      setIsTemplatesLoading(false)
    }
  }, [])

  const loadProjects = useCallback(async (templateId: string) => {
    const requestId = projectsRequestRef.current + 1
    projectsRequestRef.current = requestId
    const res = await fetch(`/api/projects?templateId=${templateId}`)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? '작업 파일을 불러오지 못했습니다.')
    }
    const data = await res.json() as ProjectSummary[]
    if (projectsRequestRef.current !== requestId) return
    setProjects(data)
  }, [])

  const prepareTemplatePreview = useCallback((detail: TemplateDetail) => {
    const initialValues = createEmptyValuesForSheets(detail.sheets)
    setActiveProjectId(null)
    setActiveProjectMeta(null)
    setPendingProjectName('')
    setIsEditingProjectName(false)
    setProjectSheets([])
    setValues(initialValues)
    setBaselineSnapshot(makeSnapshot('', initialValues, []))
    setActiveSheetId(detail.sheets[0]?.id ?? null)
    setSelectedSheetIds(detail.sheets[0] ? [detail.sheets[0].id] : [])
    setSelectionAnchorSheetId(detail.sheets[0]?.id ?? null)
    setSelectedFieldId(null)
    setCopiedSheetIds([])
    setUndoStack([])
    textEditSessionRef.current = null
    setSaveError(null)
    setExportError(null)
    setProjectTimestampMode('saved')
    setHasCompletedInitialSave(false)
    setZoomPreset('fit')
    setFitRequestKey(prev => prev + 1)
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (!selectedTemplateId) {
      projectsRequestRef.current += 1
      setTemplateDetail(null)
      setProjects([])
      setActiveProjectId(null)
      setActiveProjectMeta(null)
      setPendingProjectName('')
      setProjectSheets([])
      setValues({})
      setActiveSheetId(null)
      setSelectedSheetIds([])
      setSelectionAnchorSheetId(null)
      setSelectedFieldId(null)
      return
    }

    let cancelled = false

    const loadTemplateWorkspace = async () => {
      setIsTemplateLoading(true)
      setTemplateLoadError(null)

      try {
        const [templateRes] = await Promise.all([
          fetch(`/api/templates/${selectedTemplateId}`),
          loadProjects(selectedTemplateId),
        ])

        if (!templateRes.ok) {
          const data = await templateRes.json().catch(() => null)
          throw new Error(data?.error ?? '템플릿 상세를 불러오지 못했습니다.')
        }

        const detail = await templateRes.json() as TemplateDetail
        if (!detail.sheets.length) {
          throw new Error('템플릿에 사용할 대지가 없습니다.')
        }

        if (cancelled) return
        setTemplateDetail(detail)
        prepareTemplatePreview(detail)
      } catch (error) {
        if (cancelled) return
        setTemplateDetail(null)
        setProjects([])
        setActiveProjectId(null)
        setActiveProjectMeta(null)
        setPendingProjectName('')
        setProjectSheets([])
        setValues({})
        setActiveSheetId(null)
        setSelectedSheetIds([])
        setSelectionAnchorSheetId(null)
        setSelectedFieldId(null)
        setTemplateLoadError(error instanceof Error ? error.message : '템플릿을 불러오지 못했습니다.')
      } finally {
        if (!cancelled) {
          setIsTemplateLoading(false)
        }
      }
    }

    void loadTemplateWorkspace()

    return () => {
      cancelled = true
    }
  }, [loadProjects, prepareTemplatePreview, selectedTemplateId])

  const workspaceMode = useMemo<'template-preview' | 'project-preview' | null>(() => {
    if (!selectedTemplateId || !templateDetail) return null
    return activeProjectId ? 'project-preview' : 'template-preview'
  }, [activeProjectId, selectedTemplateId, templateDetail])

  const templateSheets = useMemo(
    () => [...(templateDetail?.sheets ?? [])].sort((a, b) => a.order - b.order),
    [templateDetail],
  )

  const workingSheets = useMemo<(ProjectSheetSnapshot | TemplateDetail['sheets'][number])[]>(() => {
    if (workspaceMode === 'project-preview' && projectSheets.length > 0) {
      return [...projectSheets].sort((a, b) => a.order - b.order)
    }
    return templateSheets
  }, [projectSheets, templateSheets, workspaceMode])

  const selectedSheet = useMemo(() => {
    if (!workingSheets.length) return null
    return workingSheets.find(sheet => sheet.id === activeSheetId) ?? workingSheets[0]
  }, [activeSheetId, workingSheets])

  const selectedField = useMemo<TemplateField | null>(() => {
    if (!selectedSheet || !selectedFieldId) return null
    return selectedSheet.fields.find(field => field.id === selectedFieldId) ?? null
  }, [selectedFieldId, selectedSheet])

  const selectedFieldIndex = useMemo(() => {
    if (!selectedSheet || !selectedField) return -1
    return selectedSheet.fields.findIndex(field => field.id === selectedField.id)
  }, [selectedField, selectedSheet])

  const selectedValueState = useMemo(() => {
    if (!selectedSheet || !selectedField) return null
    return values[selectedSheet.id]?.[selectedField.id] ?? {
      value: selectedField.defaultValue,
      alignment: selectedField.alignment,
      wrapMode: selectedField.wrapMode,
    }
  }, [selectedField, selectedSheet, values])

  const isDirty = useMemo(() => {
    if (!templateDetail || workspaceMode !== 'project-preview') return false
    return makeSnapshot(pendingProjectName, values, projectSheets) !== baselineSnapshot
  }, [baselineSnapshot, pendingProjectName, projectSheets, templateDetail, values, workspaceMode])

  const resolveSelectionAfterSheetsChange = useCallback((nextSheets: ProjectSheetSnapshot[], options?: {
    preferredActiveSheetId?: string | null
    preferredSelectedSheetIds?: string[]
  }) => {
    const ids = new Set(nextSheets.map(sheet => sheet.id))
    const preferredSelected = (options?.preferredSelectedSheetIds ?? selectedSheetIds).filter(id => ids.has(id))
    const preferredActive = options?.preferredActiveSheetId ?? activeSheetId
    const nextActiveSheetId = preferredActive && ids.has(preferredActive)
      ? preferredActive
      : preferredSelected[preferredSelected.length - 1] ?? nextSheets[0]?.id ?? null
    const nextSelectedSheetIds = preferredSelected.length > 0
      ? preferredSelected
      : (nextActiveSheetId ? [nextActiveSheetId] : [])
    const nextAnchorSheetId = selectionAnchorSheetId && ids.has(selectionAnchorSheetId)
      ? selectionAnchorSheetId
      : nextSelectedSheetIds[0] ?? nextActiveSheetId
    const nextActiveSheet = nextSheets.find(sheet => sheet.id === nextActiveSheetId) ?? null
    const nextSelectedFieldId = nextActiveSheet?.fields.some(field => field.id === selectedFieldId)
      ? selectedFieldId
      : null

    return {
      activeSheetId: nextActiveSheetId,
      selectedFieldId: nextSelectedFieldId,
      selectedSheetIds: nextSelectedSheetIds,
      selectionAnchorSheetId: nextAnchorSheetId ?? null,
    }
  }, [activeSheetId, selectedFieldId, selectedSheetIds, selectionAnchorSheetId])

  const pushUndoState = useCallback(() => {
    if (workspaceMode !== 'project-preview') return
    setUndoStack(prev => {
      const nextEntry = cloneUndoState({
        pendingProjectName,
        projectSheets,
        values,
      })
      const lastEntry = prev[prev.length - 1]
      if (lastEntry && JSON.stringify(lastEntry) === JSON.stringify(nextEntry)) {
        return prev
      }
      const nextStack = [...prev, nextEntry]
      return nextStack.length > 50 ? nextStack.slice(nextStack.length - 50) : nextStack
    })
  }, [cloneUndoState, pendingProjectName, projectSheets, values, workspaceMode])

  const applyUndoState = useCallback((state: EditorUndoState) => {
    const nextSheets = cloneProjectSheets(state.projectSheets)
    const nextValues = cloneProjectValues(state.values)
    const normalizedSelection = resolveSelectionAfterSheetsChange(nextSheets)
    textEditSessionRef.current = null
    setPendingProjectName(state.pendingProjectName)
    setProjectSheets(nextSheets)
    setValues(nextValues)
    setActiveSheetId(normalizedSelection.activeSheetId)
    setSelectedSheetIds(normalizedSelection.selectedSheetIds)
    setSelectionAnchorSheetId(normalizedSelection.selectionAnchorSheetId)
    setSelectedFieldId(normalizedSelection.selectedFieldId)
    setIsEditingProjectName(false)
  }, [cloneProjectSheets, cloneProjectValues, resolveSelectionAfterSheetsChange])

  const loadProjectIntoWorkspace = useCallback((project: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    sheetSnapshot: ProjectSheetSnapshot[]
    values: ProjectValuesBySheet
    template: TemplateDetail
  }, options?: { hasCompletedInitialSave?: boolean }) => {
    setTemplateDetail(project.template)
    setProjectSheets(project.sheetSnapshot)
    setValues(project.values)
    setActiveProjectId(project.id)
    setActiveProjectMeta({
      id: project.id,
      name: project.name,
      createdAt: String(project.createdAt),
      updatedAt: String(project.updatedAt),
    })
    setPendingProjectName(project.name)
    setIsEditingProjectName(false)
    setBaselineSnapshot(makeSnapshot(project.name, project.values, project.sheetSnapshot))
    setActiveSheetId(current => project.sheetSnapshot.some(sheet => sheet.id === current) ? current : project.sheetSnapshot[0]?.id ?? null)
    setSelectedSheetIds(current => current.filter(id => project.sheetSnapshot.some(sheet => sheet.id === id)).length > 0
      ? current.filter(id => project.sheetSnapshot.some(sheet => sheet.id === id))
      : (project.sheetSnapshot[0] ? [project.sheetSnapshot[0].id] : []))
    setSelectionAnchorSheetId(project.sheetSnapshot[0]?.id ?? null)
    setSelectedFieldId(null)
    setCopiedSheetIds([])
    setUndoStack([])
    setHasCompletedInitialSave(options?.hasCompletedInitialSave ?? true)
    textEditSessionRef.current = null
    setSaveError(null)
    setExportError(null)
  }, [])

  const performExport = useCallback(async ({
    combinedDirection: nextCombinedDirection,
    fileName,
    format,
    imageMode: nextImageMode,
    projectIdOverride,
    rangeEnd: nextRangeEnd,
    rangeStart: nextRangeStart,
    rasterMode: nextRasterMode,
    selectionMode: nextSelectionMode,
  }: {
    combinedDirection?: CombinedImageDirection
    fileName: string
    format: 'pdf' | 'png' | 'jpeg'
    imageMode?: ImageOutputMode
    projectIdOverride?: string | null
    rangeEnd?: number
    rangeStart?: number
    rasterMode?: RasterMode
    selectionMode?: ImageSelectionMode
  }) => {
    const projectId = projectIdOverride ?? activeProjectId
    if (!projectId) {
      throw new Error('내보내기 전에 작업 파일을 먼저 만들어주세요.')
    }

    setIsExporting(true)
    setExportError(null)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combinedDirection: nextCombinedDirection,
          fileName,
          format,
          imageMode: nextImageMode,
          projectId,
          rangeEnd: nextRangeEnd,
          rangeStart: nextRangeStart,
          rasterMode: nextRasterMode,
          selectionMode: nextSelectionMode,
          values,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? '내보내기에 실패했습니다.')
      }

      const blob = await res.blob()
      const fallbackName = `${fileName}.${format === 'jpeg' ? 'jpg' : format}`
      const resolvedName = getDownloadName(res.headers.get('content-disposition'), fallbackName)
      downloadBlob(blob, resolvedName)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '내보내기에 실패했습니다.')
      throw error
    } finally {
      setIsExporting(false)
    }
  }, [activeProjectId, selectedSheet?.id, values])

  const createProjectImmediately = useCallback(async (detail: TemplateDetail) => {
    const nextValues = createEmptyValuesForSheets(detail.sheets)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '새 작업',
        templateId: detail.id,
        values: nextValues,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? '새 작업을 만들지 못했습니다.')
    }

    const project = await res.json() as {
      id: string
      name: string
      createdAt: string
      sheetSnapshot: ProjectSheetSnapshot[]
      updatedAt: string
      values: ProjectValuesBySheet
    }

    await loadProjects(detail.id)
    loadProjectIntoWorkspace({
      ...project,
      template: detail,
    }, { hasCompletedInitialSave: false })
    setProjectTimestampMode('created')
    setZoomPreset('fit')
    setFitRequestKey(prev => prev + 1)
  }, [loadProjectIntoWorkspace, loadProjects])

  const executePendingAction = useCallback(async (action: PendingAction, savedProjectId?: string | null) => {
    switch (action.type) {
      case 'select-template':
        if (action.templateId === selectedTemplateId && templateDetail) {
          prepareTemplatePreview(templateDetail)
          return
        }
        setSelectedTemplateId(action.templateId)
        return
      case 'open-project': {
        const res = await fetch(`/api/projects/${action.projectId}`)
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error ?? '작업 파일을 열지 못했습니다.')
        }
        const project = await res.json() as {
          id: string
          name: string
          createdAt: string
          sheetSnapshot: ProjectSheetSnapshot[]
          updatedAt: string
          values: ProjectValuesBySheet
          template: TemplateDetail
        }
        loadProjectIntoWorkspace(project)
        setProjectTimestampMode('saved')
        setZoomPreset('fit')
        setFitRequestKey(prev => prev + 1)
        return
      }
      case 'create-project':
        if (templateDetail) {
          await createProjectImmediately(templateDetail)
        }
        return
      case 'delete-project': {
        const res = await fetch(`/api/projects/${action.projectId}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error ?? '파일을 삭제하지 못했습니다.')
        }
        if (selectedTemplateId) {
          await loadProjects(selectedTemplateId)
        }
        if (activeProjectId === action.projectId && templateDetail) {
          prepareTemplatePreview(templateDetail)
        }
        return
      }
      case 'export':
        await performExport({
          combinedDirection: action.combinedDirection,
          fileName: action.fileName,
          format: action.format,
          imageMode: action.imageMode,
          projectIdOverride: savedProjectId ?? activeProjectId,
          rangeEnd: action.rangeEnd,
          rangeStart: action.rangeStart,
          rasterMode: action.rasterMode,
          selectionMode: action.selectionMode,
        })
        return
    }
  }, [activeProjectId, createProjectImmediately, loadProjectIntoWorkspace, loadProjects, performExport, prepareTemplatePreview, selectedTemplateId, templateDetail])

  const requestAction = useCallback((action: PendingAction) => {
    if (isDirty) {
      setPendingAction(action)
      setIsDiscardDialogOpen(true)
      return
    }

    void executePendingAction(action).catch(error => {
      setExportError(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.')
    })
  }, [executePendingAction, isDirty])

  const handleSelect = useCallback((templateId: string) => {
    requestAction({ type: 'select-template', templateId })
  }, [requestAction])

  const handleUploaded = useCallback(async (templateId: string) => {
    await loadTemplates()
    requestAction({ type: 'select-template', templateId })
  }, [loadTemplates, requestAction])

  const handleDeleteProject = useCallback((projectId: string) => {
    if (!window.confirm('이 작업 파일을 삭제하시겠습니까?')) return
    requestAction({ type: 'delete-project', projectId })
  }, [requestAction])

  const handleCreateProject = useCallback(() => {
    requestAction({ type: 'create-project' })
  }, [requestAction])

  const handleOpenProject = useCallback((projectId: string) => {
    requestAction({ type: 'open-project', projectId })
  }, [requestAction])

  const handleDuplicateProject = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/duplicate`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? '작업 파일을 복제하지 못했습니다.')
      }

      const project = await res.json() as {
        id: string
        name: string
        createdAt: string
        updatedAt: string
        sheetSnapshot: ProjectSheetSnapshot[]
        values: ProjectValuesBySheet
        template: TemplateDetail
      }

      await loadProjects(project.template.id)
      loadProjectIntoWorkspace(project)
      setProjectTimestampMode('saved')
      setZoomPreset('fit')
      setFitRequestKey(prev => prev + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '작업 파일을 복제하지 못했습니다.')
    }
  }, [loadProjectIntoWorkspace, loadProjects])

  const handleSelectField = useCallback((sheetId: string, fieldId: string) => {
    textEditSessionRef.current = null
    setActiveSheetId(sheetId)
    setSelectedSheetIds([sheetId])
    setSelectionAnchorSheetId(sheetId)
    setSelectedFieldId(fieldId)
  }, [])

  const handleFieldValueChange = useCallback((value: string) => {
    if (!selectedSheet || !selectedField) return
    const currentValue = values[selectedSheet.id]?.[selectedField.id]?.value ?? selectedField.defaultValue
    if (currentValue === value) return
    const currentSession = textEditSessionRef.current
    if (!currentSession || currentSession.sheetId !== selectedSheet.id || currentSession.fieldId !== selectedField.id) {
      pushUndoState()
      textEditSessionRef.current = { sheetId: selectedSheet.id, fieldId: selectedField.id }
    }
    const wrapMode = value.includes('\n') ? 'wrap' : 'preserve'
    setValues(prev => ({
      ...prev,
      [selectedSheet.id]: {
        ...(prev[selectedSheet.id] ?? {}),
        [selectedField.id]: {
          value,
          alignment: prev[selectedSheet.id]?.[selectedField.id]?.alignment ?? selectedField.alignment,
          wrapMode,
        },
      },
    }))
  }, [pushUndoState, selectedField, selectedSheet, values])

  const handleFieldAlignmentChange = useCallback((alignment: FieldAlignment) => {
    if (!selectedSheet || !selectedField) return
    const existing = values[selectedSheet.id]?.[selectedField.id]
    const currentAlignment = existing?.alignment ?? selectedField.alignment
    if (currentAlignment === alignment) return
    pushUndoState()
    textEditSessionRef.current = null
    setValues(prev => ({
      ...prev,
      [selectedSheet.id]: {
        ...(prev[selectedSheet.id] ?? {}),
        [selectedField.id]: {
          value: prev[selectedSheet.id]?.[selectedField.id]?.value ?? selectedField.defaultValue,
          alignment,
          wrapMode: (prev[selectedSheet.id]?.[selectedField.id]?.value ?? selectedField.defaultValue).includes('\n') ? 'wrap' : 'preserve',
        },
      },
    }))
  }, [pushUndoState, selectedField, selectedSheet, values])

  const handleRenameSheet = useCallback(async (sheetId: string, nextName: string) => {
    const trimmed = nextName.trim()
    if (!trimmed) return

    if (workspaceMode === 'project-preview') {
      const currentSheet = projectSheets.find(sheet => sheet.id === sheetId)
      if (!currentSheet || currentSheet.name === trimmed) return
      pushUndoState()
      textEditSessionRef.current = null
      setProjectSheets(prev => prev.map(sheet => sheet.id === sheetId ? { ...sheet, name: trimmed } : sheet))
      return
    }

    if (!templateDetail) return

    const nextSheets = templateSheets.map(sheet => ({
      id: sheet.id,
      name: sheet.id === sheetId ? trimmed : sheet.name,
      order: sheet.order,
    }))

    const res = await fetch(`/api/templates/${templateDetail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheets: nextSheets }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      window.alert(data?.error ?? '대지 이름을 바꾸지 못했습니다.')
      return
    }

    setTemplateDetail(prev => prev ? {
      ...prev,
      sheets: prev.sheets.map(sheet => sheet.id === sheetId ? { ...sheet, name: trimmed } : sheet),
    } : prev)
    await loadTemplates()
  }, [loadTemplates, projectSheets, pushUndoState, templateDetail, templateSheets, workspaceMode])

  const handleCommitProjectName = useCallback(() => {
    const fallbackName = activeProjectMeta?.name || '새 작업'
    const trimmed = pendingProjectName.trim() || fallbackName
    if (trimmed !== pendingProjectName) {
      setPendingProjectName(trimmed)
    }
    if (workspaceMode === 'project-preview' && trimmed !== fallbackName) {
      pushUndoState()
    }
    textEditSessionRef.current = null
    setPendingProjectName(trimmed)
    setIsEditingProjectName(false)
  }, [activeProjectMeta?.name, pendingProjectName, pushUndoState, workspaceMode])

  const handleStartProjectNameEdit = useCallback(() => {
    setPendingProjectName(current => current || activeProjectMeta?.name || '새 작업')
    setIsEditingProjectName(true)
  }, [activeProjectMeta?.name])

  const handleCancelProjectNameEdit = useCallback(() => {
    setPendingProjectName(activeProjectMeta?.name || '새 작업')
    setIsEditingProjectName(false)
  }, [activeProjectMeta?.name])

  const handleSaveConfirm = useCallback(async () => {
    if (!templateDetail || !activeProjectId) return

    const trimmedName = pendingProjectName.trim()
    if (!trimmedName) {
      setSaveError('파일 이름을 입력해주세요.')
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      let nextProjectId = activeProjectId
      const res = await fetch(`/api/projects/${activeProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, values, sheetSnapshot: projectSheets }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? '파일을 저장하지 못했습니다.')
      }
      const payload = await res.json().catch(() => ({ ok: true })) as { updatedAt?: string; name?: string }
      const nextMeta: ActiveProjectMeta = activeProjectMeta ? {
        ...activeProjectMeta,
        name: payload.name ?? trimmedName,
        updatedAt: payload.updatedAt ?? new Date().toISOString(),
      } : {
        id: activeProjectId,
        name: payload.name ?? trimmedName,
        createdAt: new Date().toISOString(),
        updatedAt: payload.updatedAt ?? new Date().toISOString(),
      }
      setProjectTimestampMode('saved')

      await loadProjects(templateDetail.id)
      setActiveProjectMeta(nextMeta)
      setPendingProjectName(trimmedName)
      setIsEditingProjectName(false)
      setBaselineSnapshot(makeSnapshot(trimmedName, values, projectSheets))
      setUndoStack([])
      setHasCompletedInitialSave(true)
      textEditSessionRef.current = null
      setIsSaveDialogOpen(false)
      setIsDiscardDialogOpen(false)

      if (pendingAction) {
        const action = pendingAction
        setPendingAction(null)
        await executePendingAction(action, nextProjectId)
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '파일을 저장하지 못했습니다.')
    } finally {
      setIsSaving(false)
    }
  }, [activeProjectId, activeProjectMeta, executePendingAction, loadProjects, pendingAction, pendingProjectName, projectSheets, templateDetail, values])

  const handleOpenExportDialog = useCallback(() => {
    setExportFileName((pendingProjectName.trim() || activeProjectMeta?.name || '새 작업'))
    setExportFormat('pdf')
    setSelectionMode('all')
    setImageMode('combined')
    setCombinedDirection('horizontal')
    setRasterMode('high-res')
    setRangeStart(1)
    setRangeEnd(Math.max(1, workingSheets.length))
    setIsExportDialogOpen(true)
  }, [activeProjectMeta?.name, pendingProjectName, workingSheets.length])

  const handleExportFormatChange = useCallback((nextFormat: ExportFormat) => {
    setExportFormat(nextFormat)
  }, [])

  const handleUpdateTemplate = useCallback(async (
    templateId: string,
    payload: { name: string; category: string; sheets: Array<{ id: string; name: string; order: number }> },
  ) => {
    const res = await fetch(`/api/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? '템플릿을 수정하지 못했습니다.')
    }

    await loadTemplates()

    if (selectedTemplateId === templateId) {
      const detailRes = await fetch(`/api/templates/${templateId}`)
      if (!detailRes.ok) {
        const data = await detailRes.json().catch(() => null)
        throw new Error(data?.error ?? '수정된 템플릿을 다시 불러오지 못했습니다.')
      }
      const nextDetail = await detailRes.json() as TemplateDetail
      setTemplateDetail(nextDetail)
    }
  }, [loadTemplates, selectedTemplateId])

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? '템플릿을 삭제하지 못했습니다.')
    }

    await loadTemplates()

    if (selectedTemplateId === templateId) {
      projectsRequestRef.current += 1
      setSelectedTemplateId(null)
      setTemplateDetail(null)
      setProjects([])
      setActiveProjectId(null)
      setActiveProjectMeta(null)
      setPendingProjectName('')
      setProjectSheets([])
      setValues({})
      setBaselineSnapshot(makeSnapshot('', {}))
      setActiveSheetId(null)
      setSelectedSheetIds([])
      setSelectionAnchorSheetId(null)
      setSelectedFieldId(null)
      setCopiedSheetIds([])
      setUndoStack([])
      setHasCompletedInitialSave(false)
      setSaveError(null)
      setExportError(null)
      setTemplateLoadError(null)
      textEditSessionRef.current = null
    }
  }, [loadTemplates, selectedTemplateId])

  const handleConfirmExport = useCallback(async () => {
    const resolvedFileName = exportFileName.trim()

    const payload: PendingAction = {
      type: 'export',
      combinedDirection: exportFormat === 'pdf' ? undefined : combinedDirection,
      fileName: resolvedFileName,
      format: exportFormat,
      imageMode: exportFormat === 'pdf' ? undefined : imageMode,
      selectionMode: exportFormat === 'pdf' ? undefined : selectionMode,
      rasterMode: exportFormat === 'pdf' ? undefined : rasterMode,
      rangeStart: exportFormat === 'pdf' ? undefined : rangeStart,
      rangeEnd: exportFormat === 'pdf' ? undefined : rangeEnd,
    }

    setIsExportDialogOpen(false)
    try {
      await executePendingAction(payload, activeProjectId)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '내보내기에 실패했습니다.')
    }
  }, [activeProjectId, combinedDirection, executePendingAction, exportFileName, exportFormat, imageMode, rangeEnd, rangeStart, rasterMode, selectionMode])

  const selectedTemplate = useMemo(
    () => templates.find(template => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  )
  const canManageTemplates = session?.user?.role === 'ADMIN'

  const clampZoom = useCallback((value: number) => Math.min(maxZoomScale, Math.max(0.1, value)), [maxZoomScale])
  const zoomLabel = `${Math.round(zoomScale * 100)}%`
  const handleZoomIn = useCallback(() => {
    setZoomPreset('manual')
    setZoomScale(prev => {
      const next = clampZoom(prev + 0.1)
      return Math.abs(next - prev) < 0.001 ? prev : next
    })
  }, [clampZoom])
  const handleZoomOut = useCallback(() => {
    setZoomPreset('manual')
    setZoomScale(prev => {
      const next = clampZoom(prev - 0.1)
      return Math.abs(next - prev) < 0.001 ? prev : next
    })
  }, [clampZoom])
  const handleZoomWheel = useCallback((delta: number) => {
    setZoomPreset('manual')
    setZoomScale(prev => {
      const next = clampZoom(prev + delta)
      return Math.abs(next - prev) < 0.001 ? prev : next
    })
  }, [clampZoom])
  const handleZoomFit = useCallback(() => {
    setZoomPreset('fit')
    setFitRequestKey(prev => prev + 1)
  }, [])

  const handleFitScaleCalculated = useCallback((scale: number) => {
    setZoomScale(scale)
  }, [])

  useEffect(() => {
    setZoomScale(prev => Math.min(maxZoomScale, Math.max(0.1, prev)))
  }, [maxZoomScale])

  const shouldShowFieldToast = Boolean(
    workspaceMode === 'project-preview' &&
    selectedField &&
    selectedSheet &&
    selectedValueState,
  )

  const workspaceHeader = useMemo(() => {
    if (workspaceMode === 'template-preview') {
      return {
        title: templateDetail?.name ?? '템플릿',
      }
    }

    const timestampValue = projectTimestampMode === 'created'
      ? activeProjectMeta?.createdAt
      : activeProjectMeta?.updatedAt

    return {
      title: pendingProjectName || activeProjectMeta?.name || '새 작업',
      timestampLabel: projectTimestampMode === 'created' ? '생성 일시' : '저장 일시',
      timestampValue: timestampValue ? formatTimestamp(timestampValue) : null,
    }
  }, [activeProjectMeta, pendingProjectName, projectTimestampMode, templateDetail?.name, workspaceMode])

  const handleSelectSheet = useCallback((sheetId: string, options?: { shiftKey?: boolean; source?: 'shell' | 'field' }) => {
    const source = options?.source ?? 'shell'
    if (source !== 'field') {
      textEditSessionRef.current = null
    }
    setSelectedFieldId(current => source === 'field' ? current : null)

    if (workspaceMode !== 'project-preview' || source === 'field') {
      setActiveSheetId(sheetId)
      setSelectedSheetIds([sheetId])
      setSelectionAnchorSheetId(sheetId)
      return
    }

    if (options?.shiftKey && selectionAnchorSheetId) {
      const orderedIds = workingSheets.map(sheet => sheet.id)
      const anchorIndex = orderedIds.indexOf(selectionAnchorSheetId)
      const targetIndex = orderedIds.indexOf(sheetId)
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
        setSelectedSheetIds(orderedIds.slice(start, end + 1))
        setActiveSheetId(sheetId)
        return
      }
    }

    setActiveSheetId(sheetId)
    setSelectedSheetIds([sheetId])
    setSelectionAnchorSheetId(sheetId)
  }, [selectionAnchorSheetId, workingSheets, workspaceMode])

  const handleMoveSelectedSheets = useCallback((targetSheetId: string, position: 'before' | 'after') => {
    if (workspaceMode !== 'project-preview' || selectedSheetIds.length === 0) return
    let nextSheets: ProjectSheetSnapshot[] | null = null

    setProjectSheets(prev => {
      const ordered = [...prev].sort((a, b) => a.order - b.order)
      const movingSet = new Set(selectedSheetIds)
      const moving = ordered.filter(sheet => movingSet.has(sheet.id))
      const remaining = ordered.filter(sheet => !movingSet.has(sheet.id))
      const targetIndex = remaining.findIndex(sheet => sheet.id === targetSheetId)
      if (moving.length === 0 || targetIndex < 0) {
        return prev
      }

      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex
      const reordered = [
        ...remaining.slice(0, insertIndex),
        ...moving,
        ...remaining.slice(insertIndex),
      ].map((sheet, index) => ({ ...sheet, order: index }))
      const didChange = reordered.some((sheet, index) => sheet.id !== ordered[index]?.id)
      if (!didChange) {
        return prev
      }

      nextSheets = reordered
      return reordered
    })

    if (!nextSheets) return
    pushUndoState()
    textEditSessionRef.current = null
    const normalizedSelection = resolveSelectionAfterSheetsChange(nextSheets, {
      preferredSelectedSheetIds: selectedSheetIds,
      preferredActiveSheetId: activeSheetId,
    })
    setActiveSheetId(normalizedSelection.activeSheetId)
    setSelectedSheetIds(normalizedSelection.selectedSheetIds)
    setSelectionAnchorSheetId(normalizedSelection.selectionAnchorSheetId)
    setSelectedFieldId(normalizedSelection.selectedFieldId)
  }, [activeSheetId, pushUndoState, resolveSelectionAfterSheetsChange, selectedSheetIds, workspaceMode])

  const handleDuplicateSelectedSheets = useCallback((sheetIds: string[] = selectedSheetIds) => {
    if (workspaceMode !== 'project-preview' || sheetIds.length === 0) return
    const selectedSet = new Set(sheetIds)
    const ordered = [...projectSheets].sort((a, b) => a.order - b.order)
    const selected = ordered.filter(sheet => selectedSet.has(sheet.id))
    if (selected.length === 0) return

    const lastSelectedId = selected[selected.length - 1]?.id
    const insertAfterIndex = ordered.findIndex(sheet => sheet.id === lastSelectedId)
    const existingNames = new Set(ordered.map(sheet => sheet.name))
    const clonedValues: ProjectValuesBySheet = {}
    const clones = selected.map((sheet, index) => {
      const copyId = crypto.randomUUID()
      const baseName = `${sheet.name} 복사본`
      let nextName = baseName
      let suffix = 2
      while (existingNames.has(nextName)) {
        nextName = `${baseName} ${suffix}`
        suffix += 1
      }
      existingNames.add(nextName)
      clonedValues[copyId] = { ...(values[sheet.id] ?? {}) }
      return {
        ...sheet,
        id: copyId,
        name: nextName,
        order: insertAfterIndex + 1 + index,
      }
    })

    pushUndoState()
    textEditSessionRef.current = null
    setValues(current => ({ ...current, ...clonedValues }))
    setSelectedSheetIds(clones.map(sheet => sheet.id))
    setActiveSheetId(clones[clones.length - 1]?.id ?? null)
    setSelectionAnchorSheetId(clones[0]?.id ?? null)
    setSelectedFieldId(null)
    setProjectSheets([
      ...ordered.slice(0, insertAfterIndex + 1),
      ...clones,
      ...ordered.slice(insertAfterIndex + 1),
    ].map((sheet, index) => ({ ...sheet, order: index })))
  }, [projectSheets, pushUndoState, selectedSheetIds, values, workspaceMode])

  const handleDeleteSelectedSheets = useCallback((sheetId?: string) => {
    if (workspaceMode !== 'project-preview') return

    const targetSheetIds = (() => {
      if (sheetId) {
        return selectedSheetIds.includes(sheetId) ? selectedSheetIds : [sheetId]
      }
      if (selectedSheetIds.length > 0) return selectedSheetIds
      return activeSheetId ? [activeSheetId] : []
    })()

    if (targetSheetIds.length === 0) return
    if (projectSheets.length - targetSheetIds.length < 1) {
      window.alert('최소 1개의 대지는 남아 있어야 합니다.')
      return
    }

    const ordered = [...projectSheets].sort((a, b) => a.order - b.order)
    const targetSet = new Set(targetSheetIds)
    const firstRemovedIndex = ordered.findIndex(sheet => targetSet.has(sheet.id))
    const remaining = ordered.filter(sheet => !targetSet.has(sheet.id))
    if (remaining.length === ordered.length) return

    const nextSheets = remaining.map((sheet, index) => ({ ...sheet, order: index }))
    const fallbackSheet = remaining[firstRemovedIndex] ?? remaining[firstRemovedIndex - 1] ?? remaining[remaining.length - 1] ?? null

    pushUndoState()
    textEditSessionRef.current = null
    setProjectSheets(nextSheets)
    setValues(current => Object.fromEntries(
      Object.entries(current).filter(([key]) => !targetSet.has(key)),
    ))
    setActiveSheetId(fallbackSheet?.id ?? nextSheets[0]?.id ?? null)
    setSelectedSheetIds(fallbackSheet ? [fallbackSheet.id] : (nextSheets[0] ? [nextSheets[0].id] : []))
    setSelectionAnchorSheetId(fallbackSheet?.id ?? nextSheets[0]?.id ?? null)
    setSelectedFieldId(null)
  }, [activeSheetId, projectSheets, pushUndoState, selectedSheetIds, workspaceMode])

  useEffect(() => {
    if (workspaceMode !== 'project-preview') return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTextInputTarget = Boolean(
        target &&
        (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        )
      )
      const isMeta = event.metaKey || event.ctrlKey

      if (isMeta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setUndoStack(prev => {
          const nextState = prev[prev.length - 1]
          if (!nextState) return prev
          applyUndoState(nextState)
          return prev.slice(0, -1)
        })
        return
      }

      if (isTextInputTarget) return
      if (event.key === 'Escape') {
        setSelectedFieldId(null)
        return
      }
      if (!isMeta) return

      if (event.key.toLowerCase() === 'c' && selectedSheetIds.length > 0) {
        event.preventDefault()
        setCopiedSheetIds(selectedSheetIds)
      }

      if (event.key.toLowerCase() === 'v' && copiedSheetIds.length > 0) {
        event.preventDefault()
        handleDuplicateSelectedSheets(copiedSheetIds)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [applyUndoState, copiedSheetIds, handleDuplicateSelectedSheets, selectedSheetIds, workspaceMode])

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card/95 px-4 backdrop-blur-sm">
        <Image src="/logo.svg" alt="Printed logo" width={676} height={69} priority className="h-5 w-auto shrink-0" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" className="rounded-md p-2 transition-colors hover:bg-accent" onClick={() => signOut()} aria-label="로그아웃">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftSidebar
          canManageTemplates={canManageTemplates}
          onDeleteTemplate={handleDeleteTemplate}
          onEditTemplate={handleUpdateTemplate}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={handleSelect}
          onUploaded={handleUploaded}
          isLoading={isTemplatesLoading}
          error={templatesError}
          onRetry={loadTemplates}
        />

        {selectedTemplateId || templateDetail ? (
          <>
            <ProjectHistorySidebar
              activeProjectId={activeProjectId}
              isDirty={isDirty}
              projects={projects}
              selectedTemplateName={selectedTemplate?.name ?? templateDetail?.name ?? null}
              onCreateProject={handleCreateProject}
              onDuplicateProject={handleDuplicateProject}
              onOpenProject={handleOpenProject}
            />
            <div className="relative min-w-0 flex-1">
              <SVGCanvas
                activeSheetId={activeSheetId ?? selectedSheet?.id ?? null}
                error={templateLoadError}
                isEditingProjectName={isEditingProjectName}
                isExporting={isExporting}
                isLoading={isTemplateLoading}
                isSaving={isSaving}
                mode={workspaceMode ?? 'template-preview'}
                onCommitProjectName={handleCommitProjectName}
                onCreateProject={handleCreateProject}
                onDeleteProject={activeProjectId ? () => handleDeleteProject(activeProjectId) : undefined}
                onDeleteSelectedSheets={workspaceMode === 'project-preview' ? handleDeleteSelectedSheets : undefined}
                onOpenExport={workspaceMode === 'project-preview' ? handleOpenExportDialog : undefined}
                onOpenSave={workspaceMode === 'project-preview' ? () => setIsSaveDialogOpen(true) : undefined}
                onProjectNameChange={setPendingProjectName}
                onMoveSelectedSheets={handleMoveSelectedSheets}
                onRenameSheet={handleRenameSheet}
                onSelectField={handleSelectField}
                onSelectSheet={handleSelectSheet}
                onStartProjectNameEdit={handleStartProjectNameEdit}
                onCancelProjectNameEdit={handleCancelProjectNameEdit}
                pendingProjectName={pendingProjectName}
                selectedFieldId={selectedFieldId}
                selectedSheetIds={selectedSheetIds}
                sheets={workingSheets}
                templateName={templateDetail?.name}
                timestampLabel={workspaceHeader.timestampLabel}
                timestampValue={workspaceHeader.timestampValue}
                title={workspaceHeader.title}
                valuesBySheet={values}
                zoomLabel={zoomLabel}
                zoomScale={zoomScale}
                maxZoomScale={maxZoomScale}
                zoomPreset={zoomPreset}
                fitRequestKey={fitRequestKey}
                onFitScaleCalculated={handleFitScaleCalculated}
                onMaxZoomCalculated={setMaxZoomScale}
                onZoomFit={handleZoomFit}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomWheel={handleZoomWheel}
              />
              {shouldShowFieldToast ? (
                <FieldToastEditor
                  selectedField={selectedField}
                  selectedFieldIndex={selectedFieldIndex}
                  selectedSheet={selectedSheet}
                  valueState={selectedValueState}
                  onAlignmentChange={handleFieldAlignmentChange}
                  onClose={() => setSelectedFieldId(null)}
                  onFieldChange={handleFieldValueChange}
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            좌측에서 템플릿을 선택해주세요
          </div>
        )}
      </div>

      <SaveFileDialog
        error={saveError}
        fileName={pendingProjectName}
        isOpen={isSaveDialogOpen}
        isSaving={isSaving}
        onClose={() => {
          setIsSaveDialogOpen(false)
          setSaveError(null)
          setPendingAction(null)
          setIsDiscardDialogOpen(false)
        }}
        onConfirm={handleSaveConfirm}
        onFileNameChange={setPendingProjectName}
        isInitialSave={!hasCompletedInitialSave}
      />

      <ExportDialog
        fileName={exportFileName}
        format={exportFormat}
        imageMode={imageMode}
        combinedDirection={combinedDirection}
        isExporting={isExporting}
        isOpen={isExportDialogOpen}
        rangeEnd={rangeEnd}
        rangeStart={rangeStart}
        rasterMode={rasterMode}
        selectionMode={selectionMode}
        sheetCount={Math.max(workingSheets.length, 1)}
        onClose={() => setIsExportDialogOpen(false)}
        onConfirm={() => void handleConfirmExport()}
        onCombinedDirectionChange={setCombinedDirection}
        onFileNameChange={setExportFileName}
        onFormatChange={handleExportFormatChange}
        onImageModeChange={setImageMode}
        onRangeEndChange={setRangeEnd}
        onRangeStartChange={setRangeStart}
        onRasterModeChange={setRasterMode}
        onSelectionModeChange={setSelectionMode}
      />

      <ConfirmDiscardDialog
        isOpen={isDiscardDialogOpen}
        onCancel={() => {
          setIsDiscardDialogOpen(false)
          setPendingAction(null)
        }}
        onDiscard={() => {
          const action = pendingAction
          setPendingAction(null)
          setIsDiscardDialogOpen(false)
          if (action) {
            void executePendingAction(action).catch(error => {
              setExportError(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.')
            })
          }
        }}
        onSaveFirst={() => {
          setIsDiscardDialogOpen(false)
          setIsSaveDialogOpen(true)
        }}
      />
    </div>
  )
}
