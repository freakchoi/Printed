# Printed

인쇄용 SVG 템플릿을 업로드하고, 텍스트를 편집한 뒤 PDF/PNG/JPG로 내보내는 Next.js 앱이다.

## 개발 서버

```bash
npm run dev
```

## 주요 스크립트

```bash
npm run build
npm test
npx prisma db push
npx prisma generate
npx prisma db seed
npm run backfill:template-dimensions -- --dry-run
npm run backfill:template-dimensions
```

## 기본 계정 / 권한

- `ADMIN`
  - 아이디: `po`
  - 비밀번호: `admin`
  - 권한: 템플릿 추가, 수정, 삭제
- `USER`
  - 아이디: `teamo2`
  - 비밀번호: `team0924`
  - 권한: 템플릿 조회 및 일반 작업만 가능

로그인 정보는 seed 기준으로 생성된다.

```bash
npx prisma db push
npx prisma generate
npx prisma db seed
```

## PDF CMYK 내보내기 환경

PDF 내보내기는 CMYK 변환을 기준으로 동작한다. 따라서 로컬과 배포 환경 모두 `Ghostscript`가 설치되어 있어야 한다.

macOS:

```bash
brew install ghostscript
which gs
gs --version
```

`gs`가 없으면 PDF export는 다음 메시지와 함께 실패한다.

```text
PDF CMYK 내보내기를 사용하려면 Ghostscript 설치가 필요합니다.
```

## 템플릿 인쇄용 CMYK 프로파일

SVG 자체에는 신뢰할 수 있는 인쇄용 CMYK 프로파일 정보가 없으므로, 템플릿 등록 시 원본 문서의 Adobe Working CMYK 기준을 함께 저장한다.

- 기본 경로: `Adobe Working CMYK`
- 기본 preset: `Coated FOGRA39`
- 입력 RGB 기준: `sRGB`

지원 preset은 현재 아래와 같다.

- `Coated FOGRA39`
- `PSO Coated v3`
- `US Web Coated (SWOP)`
- `Japan Color 2001 Coated`

기존 템플릿에 인쇄 프로파일이 비어 있으면 PDF export가 차단된다. 필요하면 아래 스크립트로 기본 preset을 일괄 지정할 수 있다.

```bash
npm run backfill:template-print-profiles -- --dry-run
npm run backfill:template-print-profiles
```

## Illustrator SVG 운영 규칙

명함처럼 실제 인쇄 크기가 중요한 템플릿은 아래 규칙으로 SVG를 내보낸다.

- `Responsive`: 끈다
- `Use Artboards`: 켠다
- 대지 크기: bleed 포함 실제 외곽 크기로 맞춘다
  - 현재 명함 기준: `92 x 52 mm`
- 업로드 후 템플릿 치수 표시가 `92 × 52 mm`인지 확인한다

`Responsive`를 켜면 SVG root의 absolute `width/height`가 빠질 수 있다. 이 앱은 Illustrator식 `viewBox-only` SVG를 일부 보정하지만, 운영 기준은 여전히 `Responsive off`다.

## 템플릿 치수 backfill

기존 템플릿 중 `viewBox`가 `px`로 잘못 저장된 항목은 아래 스크립트로 다시 계산할 수 있다.

```bash
npm run backfill:template-dimensions -- --dry-run
npm run backfill:template-dimensions
```

이 스크립트는 각 `TemplateSheet.svgPath`를 다시 읽고, 현재 파서 기준으로 `width`, `height`, `unit`, `widthPx`, `heightPx`를 갱신한다.

## 배포 계획

### 1. GitHub 원격 저장소 생성 및 첫 푸시

현재 로컬 저장소는 존재하지만 remote가 없으면 아래 순서로 연결한다.

```bash
git remote add origin <github-private-repo-url>
git add .
git commit -m "Add role-based access control and admin template management"
git push -u origin main
```

주의:

- `.env.local`, `dev.db`, `uploads/`, `exports/`는 커밋하지 않는다.
- fresh clone 이후 아래 명령으로 DB와 계정을 다시 만든다.

```bash
npx prisma db push
npx prisma generate
npx prisma db seed
```

### 2. 즉시 내부 공유: ngrok

현재 구조는 로컬 SQLite, 로컬 업로드 디렉터리, Ghostscript, Puppeteer를 그대로 사용하므로 `ngrok`가 가장 현실적이다.

1. `ngrok` 설치 및 로그인

macOS:

```bash
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken <your-ngrok-token>
ngrok version
```

2. `.env.local`의 인증 도메인을 ngrok 주소로 바꿀 준비

- 기본 로컬값:

```bash
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

- ngrok 주소를 받은 뒤 아래처럼 바꾼다.

```bash
AUTH_URL=https://your-ngrok-domain.ngrok.app
NEXTAUTH_URL=https://your-ngrok-domain.ngrok.app
```

3. 서버 실행

```bash
npm run build
npm run start
```

4. 다른 터미널에서 tunnel 생성

```bash
ngrok http 3000
```

5. 발급된 `https://...ngrok.app` 주소를 `.env.local`에 반영한 뒤 서버 재시작

```bash
npm run start
```

6. 외부에서 접속

권장:

- ngrok reserved domain을 쓰면 주소 변경 관리가 쉬워진다.
- 내부 시연용이라도 관리자 계정 비밀번호는 배포 전에 바꾸는 편이 안전하다.

### 3. Vercel 배포 평가

현재 구조 그대로는 비권장이다.

이유:

- `SQLite`가 로컬 파일 기반
- `uploads/`, `exports/`가 로컬 파일 시스템 사용
- `Ghostscript`가 서버 런타임에 필요
- `Puppeteer` 런타임도 별도 검토가 필요

Vercel 전환 선행 과제:

1. `SQLite -> managed DB` 전환
2. `uploads/`, `exports/` -> object storage 전환
3. Ghostscript 기반 PDF 파이프라인 분리 또는 별도 서버로 이동
4. Puppeteer 런타임 검증
5. `.env`를 배포용으로 재구성

즉시 운영/공유는 `ngrok`, 정식 클라우드 배포는 별도 리팩터링 후 `Vercel`을 검토한다.
