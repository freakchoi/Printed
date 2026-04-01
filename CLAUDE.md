# Printed

사내 디자인 작업물(명함, 서류봉투 등) SVG 템플릿을 업로드하고, 텍스트 필드를 수정하여 PDF/PNG/JPG로 내보내는 내부 에디터 툴.

## 핵심 개념

- **Template**: SVG 파일 + 자동 감지된 `<text>` 필드 목록. `parentId`로 하위 분기(팀별 변형) 지원
- **Project**: 사용자가 저장한 편집 내용 (템플릿 + 입력값 JSON)
- **Export**: PDF → CMYK (Ghostscript 변환, 인쇄소 납품용) / PNG·JPG → RGB (화면/웹용)
- **SVG 필드 감지**: `<text id="text-xxx">기본값</text>` 패턴으로 자동 파싱

## 명령어

```bash
npm run dev        # 개발 서버 (http://localhost:3000)
npm run build      # 프로덕션 빌드
npm start          # 프로덕션 서버
npm test           # Jest 테스트
npx prisma studio  # DB GUI
npx prisma migrate dev --name <name>  # 스키마 변경 시
```

## 로컬 설치 요구사항

```bash
brew install ghostscript   # PDF CMYK 변환 필수
gs --version               # 설치 확인
```

## 기술 스택

- **Framework**: Next.js 16 App Router
- **Style**: Tailwind CSS + shadcn/ui
- **DB**: SQLite + Prisma ORM (`prisma/schema.prisma`)
- **Auth**: NextAuth.js Credentials (`lib/auth.ts`)
- **Export**: Puppeteer + Ghostscript (`lib/export.ts`)
- **SVG 파서**: `lib/svg-parser.ts`

## 주요 파일

| 파일 | 역할 |
|------|------|
| `lib/svg-parser.ts` | SVG `<text>` 요소 파싱 + 값 치환 |
| `lib/export.ts` | `exportToImage()` (PNG/JPG·RGB), `exportToPDF()` (CMYK) |
| `lib/auth.ts` | NextAuth 설정 |
| `lib/prisma.ts` | Prisma 싱글턴 |
| `components/editor/SVGCanvas.tsx` | SVG 렌더링 + 줌 |
| `components/editor/LeftSidebar.tsx` | 템플릿 목록, 하위 분기 펼치기/접기 |
| `components/editor/TextPanel.tsx` | 자동 생성 입력 필드 + 내보내기 버튼 |

## 주의사항

- SQLite는 `Json` 타입 미지원 → `fields`, `values`는 `String`으로 저장하고 앱에서 `JSON.parse/stringify`
- Ghostscript 없으면 PDF 내보내기 실패. 로컬에 반드시 설치 필요
- `uploads/`, `exports/`, `*.db`는 gitignore 처리됨
- 초기 계정: `admin / printed2024` (seed로 생성)

## 설계 문서

- 스펙: `docs/superpowers/specs/2026-04-01-printed-design.md`
- 구현 계획: `docs/superpowers/plans/2026-04-01-printed.md`
