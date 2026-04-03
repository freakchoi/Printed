import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'

const execFileAsync = promisify(execFile)

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook] GITHUB_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = req.headers.get('x-github-event')
  if (event !== 'push') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const payload = JSON.parse(body) as { ref?: string }
  if (payload.ref !== 'refs/heads/main') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const { stdout, stderr } = await execFileAsync('git', ['pull', '--ff-only', 'origin', 'main'], {
      cwd: process.cwd(),
    })
    console.info('[webhook] git pull:', stdout.trim() || stderr.trim())
    return NextResponse.json({ ok: true, output: stdout.trim() })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[webhook] git pull failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
