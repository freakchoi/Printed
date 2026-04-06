'use client'

import { useCallback, useEffect, useState } from 'react'

type ZoomPreset = 'fit' | 'manual'

export function useZoom() {
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('fit')
  const [fitRequestKey, setFitRequestKey] = useState(0)
  const [maxZoomScale, setMaxZoomScale] = useState(8)

  const clampZoom = useCallback((value: number) => Math.min(maxZoomScale, Math.max(0.1, value)), [maxZoomScale])
  const zoomLabel = `${Math.round(zoomScale * 100)}%`

  useEffect(() => {
    setZoomScale(prev => Math.min(maxZoomScale, Math.max(0.1, prev)))
  }, [maxZoomScale])

  const handleZoomIn = useCallback(() => {
    setZoomPreset('manual')
    setZoomScale(prev => {
      const next = Math.min(maxZoomScale, Math.max(0.1, prev + 0.1))
      return Math.abs(next - prev) < 0.001 ? prev : next
    })
  }, [maxZoomScale])

  const handleZoomOut = useCallback(() => {
    setZoomPreset('manual')
    setZoomScale(prev => {
      const next = Math.min(maxZoomScale, Math.max(0.1, prev - 0.1))
      return Math.abs(next - prev) < 0.001 ? prev : next
    })
  }, [maxZoomScale])

  const handleZoomWheel = useCallback((delta: number) => {
    setZoomPreset('manual')
    setZoomScale(prev => {
      const next = Math.min(maxZoomScale, Math.max(0.1, prev + delta))
      return Math.abs(next - prev) < 0.001 ? prev : next
    })
  }, [maxZoomScale])

  const handleZoomFit = useCallback(() => {
    setZoomPreset('fit')
    setFitRequestKey(prev => prev + 1)
  }, [])

  const handleFitScaleCalculated = useCallback((scale: number) => {
    setZoomScale(scale)
  }, [])

  const handleZoomSet = useCallback((scale: number) => {
    setZoomPreset('manual')
    setZoomScale(Math.min(maxZoomScale, Math.max(0.1, scale)))
  }, [maxZoomScale])

  return {
    zoomScale,
    zoomPreset,
    fitRequestKey,
    maxZoomScale,
    zoomLabel,
    setMaxZoomScale,
    handleZoomIn,
    handleZoomOut,
    handleZoomWheel,
    handleZoomFit,
    handleFitScaleCalculated,
    handleZoomSet,
  }
}
