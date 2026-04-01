'use client'
import { useRef, useState } from 'react'
import { applyValuesToSVG } from '@/lib/svg-parser'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SVGCanvasProps {
  svgContent: string
  values: Record<string, string>
}

export function SVGCanvas({ svgContent, values }: SVGCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  const renderedSVG = applyValuesToSVG(svgContent, values)

  return (
    <div className="flex-1 flex flex-col bg-muted/30">
      <div className="flex items-center justify-end gap-1 p-2 border-b bg-card">
        <Button
          variant="ghost" size="icon"
          onClick={() => setZoom(z => Math.min(z + 0.1, 3))}
          aria-label="확대"
        >
          <ZoomIn size={16} />
        </Button>
        <Button
          variant="ghost" size="icon"
          onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))}
          aria-label="축소"
        >
          <ZoomOut size={16} />
        </Button>
        <Button
          variant="ghost" size="icon"
          onClick={() => setZoom(1)}
          aria-label="원래 크기"
        >
          <RotateCcw size={16} />
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-auto p-8">
        <div
          ref={containerRef}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="shadow-lg bg-white"
          dangerouslySetInnerHTML={{ __html: renderedSVG }}
        />
      </div>
    </div>
  )
}
