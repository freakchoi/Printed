import puppeteer from 'puppeteer'
import sharp from 'sharp'
import path from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const GUIDE_DIR = path.join(process.cwd(), 'guide')
const CROP_DIR = path.join(GUIDE_DIR, 'cropped')

// Ensure crop directory exists
mkdirSync(CROP_DIR, { recursive: true })

// Scale factor: raw screenshots are 1963x1160 (device pixel ratio ~1.38 on Retina)
// All crop regions defined in raw pixels
type CropRegion = { left: number; top: number; width: number; height: number }

async function cropImage(srcFile: string, outFile: string, region: CropRegion): Promise<string> {
  const srcPath = path.join(GUIDE_DIR, srcFile)
  const outPath = path.join(CROP_DIR, outFile)
  await sharp(srcPath)
    .extract(region)
    .toFile(outPath)
  return outPath
}

async function imageToDataUrl(filePath: string): Promise<string> {
  const data = readFileSync(filePath)
  return `data:image/png;base64,${data.toString('base64')}`
}

async function prepareImages() {
  // Full-size images (no crop — just read as-is)
  const full = (file: string) => path.join(GUIDE_DIR, file)

  // Cropped images — regions in actual raw pixels
  const actorDialog = await cropImage('00-actor-dialog.png', 'actor-dialog.png',
    { left: 700, top: 370, width: 570, height: 420 })

  const loginForm = await cropImage('01-login.png', 'login.png',
    { left: 570, top: 230, width: 820, height: 570 })

  const loginFilled = await cropImage('01-login-filled.png', 'login-filled.png',
    { left: 570, top: 230, width: 820, height: 570 })

  const templateList = await cropImage('03-template-selected.png', 'template-list.png',
    { left: 0, top: 55, width: 510, height: 600 })

  const templateFull = full('03-template-selected.png')

  const createProject = await cropImage('04-create-project.png', 'create-project.png',
    { left: 183, top: 55, width: 1100, height: 220 })

  const editorFull = full('05-editor-fields.png')
  const editorToast = await cropImage('05-editor-fields.png', 'editor-toast.png',
    { left: 930, top: 925, width: 590, height: 225 })

  const exportDialog = await cropImage('06-export.png', 'export-dialog.png',
    { left: 630, top: 270, width: 700, height: 600 })

  const saveDialog = await cropImage('07-save-history.png', 'save-dialog.png',
    { left: 680, top: 380, width: 560, height: 350 })

  const historySidebar = await cropImage('08-history-sidebar.png', 'history-sidebar.png',
    { left: 183, top: 55, width: 290, height: 360 })

  return {
    actorDialog,
    loginForm,
    loginFilled,
    templateList,
    templateFull,
    createProject,
    editorFull,
    editorToast,
    exportDialog,
    saveDialog,
    historySidebar,
  }
}

async function buildHtml(imgs: Awaited<ReturnType<typeof prepareImages>>): Promise<string> {
  const url = async (p: string) => imageToDataUrl(p)

  const sections = [
    {
      title: '1. 로그인 방법',
      description: '브라우저에서 ngrok 주소로 접속한 후, 아이디 <strong>teamo2</strong>와 비밀번호를 입력하고 <strong>로그인</strong> 버튼을 클릭합니다.',
      images: [
        { src: await url(imgs.loginForm), caption: '① 로그인 화면 — 아이디와 비밀번호 입력란' },
        { src: await url(imgs.loginFilled), caption: '② 정보 입력 완료 후 로그인 버튼 클릭' },
      ],
    },
    {
      title: '2. 작업자 이름 설정',
      description: '로그인 후 우측 상단의 이름 버튼을 클릭하면 <strong>작업자 이름 설정</strong> 창이 열립니다.<br>영문 닉네임과 팀명을 입력합니다. <em>예: Moca / PO팀</em><br>이 이름은 저장·내보내기 이력에 기록되어 누가 작업했는지 확인할 수 있습니다.',
      images: [
        { src: await url(imgs.actorDialog), caption: '③ 작업자 이름 입력 — 영문 닉네임과 팀명 입력 후 저장' },
      ],
    },
    {
      title: '3. 템플릿 선택',
      description: '왼쪽 사이드바에서 카테고리(명함·쿠폰·현수막)를 클릭해 펼친 후 원하는 템플릿을 선택합니다. 선택 시 캔버스에 앞·뒤 대지가 표시됩니다.',
      images: [
        { src: await url(imgs.templateList), caption: '④ 왼쪽 템플릿 목록에서 카테고리 선택' },
        { src: await url(imgs.templateFull), caption: '⑤ 템플릿 선택 시 앞·뒤 대지 미리보기' },
      ],
    },
    {
      title: '4. 만들기 클릭',
      description: '원하는 템플릿을 선택한 뒤 중앙 히스토리 사이드바의 <strong>+ 만들기</strong> 버튼을 클릭합니다. 새 작업 파일이 생성되고 이력에 추가됩니다.',
      images: [
        { src: await url(imgs.createProject), caption: '⑥ 만들기 버튼 클릭 → 새 작업 파일 생성 및 이력 등록' },
      ],
    },
    {
      title: '5. 텍스트 수정 방법',
      description: '캔버스에서 수정할 텍스트 항목을 <strong>클릭</strong>하면 하단에 <strong>텍스트 수정</strong> 패널이 나타납니다. 내용을 입력하고 정렬(좌·중·우)을 선택합니다. 다른 필드를 클릭하면 해당 필드로 전환됩니다.',
      images: [
        { src: await url(imgs.editorFull), caption: '⑦ 텍스트 필드 클릭 — 파란 테두리로 선택됨' },
        { src: await url(imgs.editorToast), caption: '⑧ 하단 수정 패널 — 내용 입력 및 정렬 선택' },
      ],
    },
    {
      title: '6. 내보내기 방법',
      description: '상단 오른쪽 <strong>내보내기</strong> 버튼을 클릭합니다. 파일 이름을 입력하고 형식을 선택합니다:<br>• <strong>PDF</strong> — 인쇄소 납품용 (CMYK 변환)<br>• <strong>PNG / JPG</strong> — 화면·웹용 (RGB)<br>저장 버튼 클릭 시 브라우저 기본 다운로드 폴더에 저장됩니다.',
      images: [
        { src: await url(imgs.exportDialog), caption: '⑨ 내보내기 다이얼로그 — 파일명 입력 후 형식 선택' },
      ],
    },
    {
      title: '7. 저장 및 작업 이력 보관',
      description: '상단의 <strong>저장</strong> 버튼으로 현재 편집 내용을 저장합니다. 저장된 파일은 중앙 이력 사이드바에 유지되며, 저장 일시와 작업자 이름이 함께 기록됩니다. 이름을 클릭하면 이어서 편집할 수 있습니다.',
      images: [
        { src: await url(imgs.saveDialog), caption: '⑩ 저장 다이얼로그 — 파일 이름 확인 후 저장' },
        { src: await url(imgs.historySidebar), caption: '⑪ 작업 이력 — 파일명·저장 일시·저장자 기록됨' },
      ],
    },
  ]

  const sectionHtml = sections.map(section => {
    const imagesHtml = section.images.map(img => `
      <figure class="screenshot">
        <img src="${img.src}" alt="${img.caption}" />
        <figcaption>${img.caption}</figcaption>
      </figure>`).join('')

    return `
      <section class="guide-section">
        <h2>${section.title}</h2>
        <p class="description">${section.description}</p>
        <div class="screenshots">${imagesHtml}</div>
      </section>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    font-size: 13px;
    color: #222;
    line-height: 1.7;
    background: #fff;
  }
  .cover {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    page-break-after: always;
    background: linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%);
    text-align: center;
    padding: 40px;
  }
  .cover h1 {
    font-size: 34px;
    font-weight: 700;
    color: #1e3a8a;
    margin-bottom: 14px;
  }
  .cover .subtitle { font-size: 15px; color: #475569; margin-bottom: 6px; }
  .cover .date { font-size: 13px; color: #94a3b8; margin-top: 28px; }
  .guide-section {
    padding: 28px 36px 20px;
    page-break-before: always;
  }
  h2 {
    font-size: 18px;
    font-weight: 700;
    color: #1e3a8a;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid #1e3a8a;
  }
  .description {
    font-size: 13px;
    color: #374151;
    margin-bottom: 18px;
    line-height: 1.8;
  }
  em { color: #6b7280; }
  .screenshots {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .screenshots.two-col {
    flex-direction: row;
    gap: 14px;
  }
  .screenshots.two-col figure { flex: 1; }
  figure.screenshot {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    background: #f8fafc;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  figure.screenshot img {
    width: 100%;
    display: block;
  }
  figcaption {
    font-size: 11px;
    color: #64748b;
    padding: 7px 12px;
    background: #f1f5f9;
    border-top: 1px solid #e2e8f0;
  }
</style>
</head>
<body>
  <div class="cover">
    <h1>Printed 사용 가이드</h1>
    <p class="subtitle">디자인 작업물 편집 및 내보내기 안내</p>
    <p class="subtitle">TeamO2 내부 사용자용</p>
    <p class="date">2026년 4월</p>
  </div>
  ${sectionHtml}
</body>
</html>`
}

async function main() {
  console.log('이미지 크롭 중...')
  const imgs = await prepareImages()

  console.log('HTML 생성 중...')
  const html = await buildHtml(imgs)

  // Save HTML for debug
  writeFileSync(path.join(GUIDE_DIR, 'guide-debug.html'), html)

  console.log('PDF 렌더링 중...')
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })

  const outputPath = path.join(GUIDE_DIR, 'printed-guide.pdf')
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  })

  await browser.close()
  console.log(`완료: ${outputPath}`)
}

main().catch(console.error)
