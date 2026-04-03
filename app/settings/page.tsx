'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function SettingsPage() {
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error' | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    setMsgType(null)
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/user/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: form.get('currentPassword'),
        newPassword: form.get('newPassword'),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg('비밀번호가 변경되었습니다.')
      setMsgType('success')
    } else {
      setMsg(data.error ?? '오류가 발생했습니다.')
      setMsgType('error')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <Link href="/editor" className="flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground">
        <ArrowLeft size={14} /> 에디터로 돌아가기
      </Link>
      <Card className="max-w-sm">
        <CardHeader><CardTitle>비밀번호 변경</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">현재 비밀번호</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">새 비밀번호 (8자 이상)</Label>
              <Input id="newPassword" name="newPassword" type="password" required />
            </div>
            {msg && (
              <p className={`text-sm ${msgType === 'success' ? 'text-primary' : 'text-destructive'}`}>
                {msg}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '변경 중...' : '변경'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
