import { access } from 'fs/promises'
import path from 'path'
import type { AdobeWorkingCmykPreset, SourceRgbIcc, TemplatePrintSettings } from '@/lib/template-model'
import { ADOBE_WORKING_CMYK_PRESETS } from '@/lib/print-color'

export interface ResolvedPrintColorProfile {
  label: string
  outputIccPath: string
  sourceRgbIccPath: string
}

const ICC_SEARCH_PATHS = {
  sRgb: [
    '/System/Library/ColorSync/Profiles/sRGB Profile.icc',
    '/Library/ColorSync/Profiles/sRGB Profile.icc',
  ],
  adobeRgb: [
    '/Library/Application Support/Adobe/Color/Profiles/Recommended/AdobeRGB1998.icc',
    '/Library/ColorSync/Profiles/AdobeRGB1998.icc',
    '/System/Library/ColorSync/Profiles/AdobeRGB1998.icc',
    '/usr/share/color/icc/colord/AdobeRGB1998.icc',
  ],
  presets: {
    FOGRA39: [
      '/Library/Application Support/Adobe/Color/Profiles/Recommended/CoatedFOGRA39.icc',
    ],
    PSO_COATED_V3: [
      '/Library/Application Support/Adobe/Color/Profiles/Recommended/PSOcoated_v3.icc',
      '/Library/Application Support/Adobe/Color/Profiles/Recommended/PSO Coated v3.icc',
    ],
    US_WEB_COATED_SWOP: [
      '/Library/Application Support/Adobe/Color/Profiles/Recommended/USWebCoatedSWOP.icc',
    ],
    JAPAN_COLOR_2001_COATED: [
      '/Library/Application Support/Adobe/Color/Profiles/Recommended/JapanColor2001Coated.icc',
    ],
  } satisfies Record<AdobeWorkingCmykPreset, string[]>,
}

async function resolveExistingPath(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return null
}

async function resolveSourceRgbIccPath(preset: SourceRgbIcc = 'sRGB') {
  if (preset === 'AdobeRGB') {
    const resolved = await resolveExistingPath(ICC_SEARCH_PATHS.adobeRgb)
    if (!resolved) {
      throw new Error('AdobeRGB ICC 프로파일을 찾을 수 없습니다. Adobe Creative Cloud가 설치되어 있는지 확인하세요.')
    }
    return resolved
  }

  const resolved = await resolveExistingPath(ICC_SEARCH_PATHS.sRgb)
  if (!resolved) {
    throw new Error('sRGB ICC 프로파일을 찾을 수 없습니다.')
  }
  return resolved
}

async function resolveAdobePresetPath(preset: AdobeWorkingCmykPreset) {
  const resolved = await resolveExistingPath(ICC_SEARCH_PATHS.presets[preset])
  if (!resolved) {
    throw new Error(`선택한 CMYK 프로파일을 찾을 수 없습니다: ${preset}`)
  }
  return resolved
}

function getPresetLabel(preset: AdobeWorkingCmykPreset) {
  return ADOBE_WORKING_CMYK_PRESETS.find(item => item.value === preset)?.label ?? preset
}

export async function resolveTemplatePrintProfile(settings: TemplatePrintSettings | null | undefined): Promise<ResolvedPrintColorProfile> {
  if (!settings?.colorProfileMode) {
    throw new Error('이 템플릿의 인쇄용 CMYK 프로파일이 설정되지 않았습니다.')
  }

  const sourceRgbIccPath = await resolveSourceRgbIccPath(settings.sourceRgbIcc ?? 'sRGB')

  if (settings.colorProfileMode === 'custom-icc') {
    if (!settings.customIccPath) {
      throw new Error('이 템플릿의 인쇄용 CMYK 프로파일이 설정되지 않았습니다.')
    }

    const resolvedPath = path.resolve(settings.customIccPath)
    const allowedDir = path.resolve(process.cwd(), 'uploads', 'icc')
    if (!resolvedPath.startsWith(allowedDir + path.sep) && resolvedPath !== allowedDir) {
      throw new Error('ICC 프로파일 파일 경로가 유효하지 않습니다.')
    }

    try {
      await access(resolvedPath)
    } catch {
      throw new Error('ICC 프로파일 파일을 읽을 수 없습니다.')
    }

    return {
      label: path.basename(resolvedPath),
      outputIccPath: resolvedPath,
      sourceRgbIccPath,
    }
  }

  if (!settings.adobeWorkingCmykPreset) {
    throw new Error('이 템플릿의 인쇄용 CMYK 프로파일이 설정되지 않았습니다.')
  }

  return {
    label: getPresetLabel(settings.adobeWorkingCmykPreset),
    outputIccPath: await resolveAdobePresetPath(settings.adobeWorkingCmykPreset),
    sourceRgbIccPath,
  }
}
