'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastState = {
  id: number
  kind: 'error' | 'success'
  message: string
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = useCallback((message: string, kind: ToastState['kind'] = 'error') => {
    const nextToast = { id: Date.now(), kind, message }
    setToast(nextToast)
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(current => current?.id === nextToast.id ? null : current)
      toastTimerRef.current = null
    }, kind === 'error' ? 4200 : 2600)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  return { toast, setToast, showToast }
}
