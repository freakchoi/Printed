import type { AdobeWorkingCmykPreset, TemplatePrintSettings } from '@/lib/template-model'

export const ADOBE_WORKING_CMYK_PRESETS: Array<{ value: AdobeWorkingCmykPreset; label: string }> = [
  { value: 'FOGRA39', label: 'Coated FOGRA39' },
  { value: 'PSO_COATED_V3', label: 'PSO Coated v3' },
  { value: 'US_WEB_COATED_SWOP', label: 'US Web Coated (SWOP)' },
  { value: 'JAPAN_COLOR_2001_COATED', label: 'Japan Color 2001 Coated' },
]

export function hasConfiguredPrintColorProfile(settings: TemplatePrintSettings | null | undefined) {
  if (!settings?.colorProfileMode) return false
  if (settings.colorProfileMode === 'adobe-working-cmyk') return Boolean(settings.adobeWorkingCmykPreset)
  return Boolean(settings.customIccPath)
}
