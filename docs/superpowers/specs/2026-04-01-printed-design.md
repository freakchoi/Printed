# Printed — 설계 문서

**작성일:** 2026-04-01
**상태:** 승인됨

---

## 1. 프로젝트 개요

사내 디자인 작업물(명함, 서류봉투, 레터헤드 등)을 온라인으로 업로드하고,
디자이너가 아닌 사람도 텍스트 내용을 쉽게 수정하여 PDF/PNG로 저장할 수 있는 내부 에디터 툴.

**핵심 요구사항:**
- SVG 템플릿 업로드 → 텍스트 필드 자동 감지
- 실시간 프리뷰 + 우측 패널에서 텍스트 수정
- 편집 내용 서버 저장 (재편집 가능)
- PDF(CMYK, 인쇄소 납품용) + PNG(미리보기/웹용) 내보내기
- 간단한 로그인 (아이디/비밀번호, 개인 비밀번호 변경 가능)
- 로컬 배포

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 스타일 | Tailwind CSS + shadcn/ui |
| SVG 편집 | fabric.js |
| PDF 생성 | Puppeteer (RGB) → Ghostscript (CMYK 변환) |
| PNG 생성 | Puppeteer |
| 데이터베이스 | SQLite + Prisma ORM |
| 인증 | NextAuth.js (Credentials Provider) |
| 배포 | 로컬 (npm start) |
| 로컬 의존성 | Ghostscript (`brew install ghostscript`) |

---

## 3. 페이지 구조

```
/               → 로그인 페이지 (NextAuth Credentials)
/editor         → 메인 에디터 (3패널)
/settings       → 계정 설정 (비밀번호 변경)
```

---

## 4. UI 레이아웃 — 에디터

접기형 3패널 구조:

```
┌──────┬─────────────────────────┬──────────────┐
│ 아이콘│                         │  텍스트 수정  │
│ 사이드│      SVG 프리뷰          │  (자동 생성)  │
│  바   │      (fabric.js)        │              │
│      │                         │  [PDF 저장]  │
│ [접기]│                         │  [PNG 저장]  │
└──────┴─────────────────────────┴──────────────┘
```

- **좌측 사이드바:** 템플릿 아이콘 목록, 접기/펼치기 토글, 카테고리 그룹핑
- **중앙 캔버스:** SVG 렌더링, 실시간 텍스트 반영, 앞/뒷면 탭, 줌 인/아웃
- **우측 패널:** SVG에서 감지된 `<text>` 요소 기반 Input 자동 생성, 저장/내보내기 버튼
- **테마:** 라이트/다크 모드 전환 지원

---

## 5. 데이터 모델

```prisma
model User {
  id           String    @id @default(cuid())
  username     String    @unique
  passwordHash String
  createdAt    DateTime  @default(now())
  projects     Project[]
}

model Template {
  id        String    @id @default(cuid())
  name      String
  category  String    // 명함, 서류봉투, 레터헤드 등
  svgPath   String    // /uploads/svg/filename.svg
  fields    Json      // [{ id, label, defaultValue }]
  thumbnail String?   // /uploads/thumbnails/filename.png
  createdAt DateTime  @default(now())
  projects  Project[]
}

model Project {
  id         String   @id @default(cuid())
  name       String
  values     Json     // { "text-id": "값", ... }
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  userId     String
  templateId String
  user       User     @relation(fields: [userId], references: [id])
  template   Template @relation(fields: [templateId], references: [id])
}
```

**파일시스템:**
- `/uploads/svg/` — 원본 SVG 템플릿
- `/uploads/thumbnails/` — 템플릿 썸네일
- `/exports/` — 생성된 PDF/PNG (임시)

---

## 6. 핵심 컴포넌트

### SVGCanvas (핵심)
- SVG 파일 로드 및 fabric.js 렌더링
- `parseSVGFields(svgString)` → `[{ id, label, defaultValue }]` 반환
- `updateSVGText(id, newValue)` → SVG DOM 즉시 반영
- 앞면/뒷면 탭 전환
- 줌 인/아웃

### TextPanel
- `fields: Field[]` props로 Input 자동 생성
- 입력 시 `onFieldChange(id, value)` → SVGCanvas에 전달
- 프로젝트 저장/불러오기
- PDF/PNG 내보내기 트리거

### LeftSidebar
- 템플릿 목록 (아이콘 + 이름)
- 접기 시 아이콘만 표시
- 카테고리별 그룹핑

---

## 7. API Routes

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/[...nextauth]` | 로그인 / 세션 |
| GET | `/api/templates` | 템플릿 목록 |
| POST | `/api/templates` | SVG 업로드 + 텍스트 필드 파싱 |
| GET | `/api/projects` | 프로젝트 목록 |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects/[id]` | 프로젝트 불러오기 |
| PUT | `/api/projects/[id]` | 편집 내용 저장 |
| DELETE | `/api/projects/[id]` | 프로젝트 삭제 |
| POST | `/api/export` | PDF(CMYK) / PNG 생성 |
| PUT | `/api/user/password` | 비밀번호 변경 |

---

## 8. PDF/PNG 내보내기 흐름

```
POST /api/export
  ├── body: { projectId, format: 'pdf' | 'png' }
  ├── SVG + values 조합 → 완성된 SVG 문자열 생성
  ├── Puppeteer로 headless 렌더링
  ├── format === 'pdf'
  │     └── Puppeteer → RGB PDF → Ghostscript → CMYK PDF → 다운로드
  └── format === 'png'
        └── Puppeteer screenshot → PNG → 다운로드
```

**Ghostscript 변환 명령:**
```bash
gs -dSAFER -dBATCH -dNOPAUSE \
   -sDEVICE=pdfwrite \
   -sColorConversionStrategy=CMYK \
   -dProcessColorModel=/DeviceCMYK \
   -sOutputFile=output_cmyk.pdf input_rgb.pdf
```

---

## 9. 인증

- NextAuth.js Credentials Provider
- 비밀번호: bcrypt 해시 저장
- 세션: JWT (서버리스 친화적)
- 초기 계정: 환경변수 또는 seed script로 수동 설정
- 사용자 본인 비밀번호 변경 가능 (`/settings`)
- 관리자 개념 없음 (모든 로그인 유저 동일 권한)

---

## 10. 프로젝트 구조 (예상)

```
printed/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── editor/page.tsx
│   ├── settings/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── templates/route.ts
│       ├── projects/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── export/route.ts
│       └── user/password/route.ts
├── components/
│   ├── editor/
│   │   ├── LeftSidebar.tsx
│   │   ├── SVGCanvas.tsx
│   │   └── TextPanel.tsx
│   └── ui/           (shadcn/ui)
├── lib/
│   ├── prisma.ts
│   ├── svg-parser.ts  (텍스트 필드 감지)
│   └── export.ts      (Puppeteer + Ghostscript)
├── prisma/
│   └── schema.prisma
├── uploads/           (gitignore)
│   ├── svg/
│   └── thumbnails/
└── exports/           (gitignore)
```

---

## 11. 로컬 설치 요구사항

```bash
# Node.js 18+
node --version

# Ghostscript (CMYK PDF 변환)
brew install ghostscript

# 프로젝트 실행
npm install
npx prisma migrate dev
npm run dev
```
