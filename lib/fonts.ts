/**
 * 단일 폰트 레지스트리.
 * export.ts(buildFontFaceCSS, embedFontsInSVG)와 svg-parser.ts(MEASUREMENT_FONT_REGISTRY)가
 * 모두 이 목록을 참조한다. 폰트 추가/제거는 이 파일만 수정하면 된다.
 */
export interface FontEntry {
  file: string
  family: string
  weight: string
}

export const FONT_REGISTRY: FontEntry[] = [
  { file: 'Pretendard-Thin.otf', family: 'Pretendard', weight: '100' },
  { file: 'Pretendard-ExtraLight.otf', family: 'Pretendard', weight: '200' },
  { file: 'Pretendard-Light.otf', family: 'Pretendard', weight: '300' },
  { file: 'Pretendard-Regular.otf', family: 'Pretendard', weight: '400' },
  { file: 'Pretendard-Medium.otf', family: 'Pretendard', weight: '500' },
  { file: 'Pretendard-SemiBold.otf', family: 'Pretendard', weight: '600' },
  { file: 'Pretendard-Bold.otf', family: 'Pretendard', weight: '700' },
  { file: 'Pretendard-ExtraBold.otf', family: 'Pretendard', weight: '800' },
  { file: 'Pretendard-Black.otf', family: 'Pretendard', weight: '900' },
  { file: 'PretendardJP-Thin.otf', family: 'Pretendard JP', weight: '100' },
  { file: 'PretendardJP-ExtraLight.otf', family: 'Pretendard JP', weight: '200' },
  { file: 'PretendardJP-Light.otf', family: 'Pretendard JP', weight: '300' },
  { file: 'PretendardJP-Regular.otf', family: 'Pretendard JP', weight: '400' },
  { file: 'PretendardJP-Medium.otf', family: 'Pretendard JP', weight: '500' },
  { file: 'PretendardJP-SemiBold.otf', family: 'Pretendard JP', weight: '600' },
  { file: 'PretendardJP-Bold.otf', family: 'Pretendard JP', weight: '700' },
  { file: 'PretendardJP-ExtraBold.otf', family: 'Pretendard JP', weight: '800' },
  { file: 'PretendardJP-Black.otf', family: 'Pretendard JP', weight: '900' },
  { file: 'GmarketSansTTFLight.ttf', family: 'Gmarket Sans TTF', weight: '300' },
  { file: 'GmarketSansTTFMedium.ttf', family: 'Gmarket Sans TTF', weight: '500' },
  { file: 'GmarketSansTTFBold.ttf', family: 'Gmarket Sans TTF', weight: '700' },
  { file: 'GmarketSansLight.otf', family: 'Gmarket Sans', weight: '300' },
  { file: 'GmarketSansMedium.otf', family: 'Gmarket Sans', weight: '500' },
  { file: 'GmarketSansBold.otf', family: 'Gmarket Sans', weight: '700' },
  { file: 'NotoSansJP-Thin.ttf', family: 'Noto Sans JP', weight: '100' },
  { file: 'NotoSansJP-ExtraLight.ttf', family: 'Noto Sans JP', weight: '200' },
  { file: 'NotoSansJP-Light.ttf', family: 'Noto Sans JP', weight: '300' },
  { file: 'NotoSansJP-Regular.ttf', family: 'Noto Sans JP', weight: '400' },
  { file: 'NotoSansJP-Medium.ttf', family: 'Noto Sans JP', weight: '500' },
  { file: 'NotoSansJP-SemiBold.ttf', family: 'Noto Sans JP', weight: '600' },
  { file: 'NotoSansJP-Bold.ttf', family: 'Noto Sans JP', weight: '700' },
  { file: 'NotoSansJP-ExtraBold.ttf', family: 'Noto Sans JP', weight: '800' },
  { file: 'NotoSansJP-Black.ttf', family: 'Noto Sans JP', weight: '900' },
]

/** svg-parser.ts의 canvas 폰트 등록용 — 시스템 폰트 포함 */
export const MEASUREMENT_FONT_EXTRAS: Array<{ path: string; family: string; weight: string }> = [
  { path: '/System/Library/Fonts/Supplemental/AppleMyungjo.ttf', family: 'AppleMyungjo', weight: '400' },
]
