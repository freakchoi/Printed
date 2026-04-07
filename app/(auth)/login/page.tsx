'use client'

import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [failCount, setFailCount] = useState(0)
  const roomyInputClass = 'mt-2 h-10 rounded-md px-3 py-2'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const res = await signIn('credentials', {
      username: form.get('username'),
      password: form.get('password'),
      redirect: false,
    })
    if (res?.error || res?.ok === false) {
      const next = failCount + 1
      setFailCount(next)
      setError(next >= 5
        ? '로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.'
        : '아이디 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
    } else {
      router.refresh()
      router.push('/editor')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden login-bg px-4 py-6 sm:px-6 sm:py-8">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full login-glow blur-3xl" />

      <main className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center sm:min-h-[calc(100vh-4rem)]">
        <section className="w-full max-w-md rounded-xl border border-border/80 bg-background shadow-[0_24px_60px_rgba(2,8,23,0.18)]">
          <div className="space-y-0">
            <div className="border-b px-6 py-5 text-center sm:px-8">
              <Image
                src="/logo-login.svg"
                alt="Printed logo"
                width={295}
                height={69}
                priority
                className="mx-auto h-6 w-auto sm:h-7"
              />
              <p className="mt-3 text-sm text-muted-foreground">관리 계정 또는 사내 사용자 계정으로 로그인합니다.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5 sm:px-8">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-foreground">아이디</Label>
                <Input
                  id="username"
                  name="username"
                  required
                  autoFocus
                  className="h-10 rounded-md px-3 py-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">비밀번호</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="h-10 rounded-md px-3 py-2"
                />
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="border-t pt-5">
                <Button
                  type="submit"
                  className="h-10 w-full rounded-md text-sm font-semibold"
                  disabled={loading}
                >
                  {loading ? '로그인 중...' : '로그인'}
                </Button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}
