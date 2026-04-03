import { render, screen } from '@testing-library/react'
import { ExportDialog } from '@/components/editor/ExportDialog'

describe('ExportDialog', () => {
  it('PNG/JPG 대지 선택에서 현재 대지를 노출하지 않는다', () => {
    render(
      <ExportDialog
        combinedDirection="horizontal"
        fileName="sample"
        format="png"
        imageMode="combined"
        isExporting={false}
        isOpen
        rangeEnd={3}
        rangeStart={1}
        rasterMode="high-res"
        selectionMode="all"
        sheetCount={3}
        onClose={() => {}}
        onConfirm={() => {}}
        onCombinedDirectionChange={() => {}}
        onFileNameChange={() => {}}
        onFormatChange={() => {}}
        onImageModeChange={() => {}}
        onRangeEndChange={() => {}}
        onRangeStartChange={() => {}}
        onRasterModeChange={() => {}}
        onSelectionModeChange={() => {}}
      />,
    )

    expect(screen.queryByText('현재 대지')).not.toBeInTheDocument()
    expect(screen.getByText('전체 대지')).toBeInTheDocument()
    expect(screen.getByText('범위 선택')).toBeInTheDocument()
  })
})
