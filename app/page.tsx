import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 rounded-[32px] border border-black/5 bg-white px-10 py-16 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-zinc-950">
        <Image src="/logo.svg" alt="Printed logo" width={72} height={72} priority />
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Printed 템플릿 스튜디오
          </h1>
          <p className="mx-auto max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            여러 SVG를 하나의 템플릿 묶음으로 등록하고, 대지별 텍스트를 수정한 뒤 인쇄용 PDF로 한 번에 내보낼 수 있습니다.
          </p>
        </div>
        <a
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          href="/editor"
        >
          에디터 열기
        </a>
      </main>
    </div>
  );
}
