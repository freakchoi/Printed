import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 font-sans dark:bg-background">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 rounded-[32px] border border-black/5 bg-card px-10 py-16 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-card">
        <Image src="/logo.svg" alt="Printed logo" width={72} height={72} priority />
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Printed 템플릿 스튜디오
          </h1>
          <p className="mx-auto max-w-xl text-base leading-7 text-muted-foreground">
            여러 SVG를 하나의 템플릿 묶음으로 등록하고, 대지별 텍스트를 수정한 뒤 인쇄용 PDF로 한 번에 내보낼 수 있습니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/editor">에디터 열기</Link>
        </Button>
      </main>
    </div>
  );
}
