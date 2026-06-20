import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { sendTelegram } from '@/lib/telegram'

// Admin-only Telegram sender. Token is never exposed to the client.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(token, true)
    if ((decoded as any).role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { chat_id, text } = await req.json()
    if (!chat_id || !text) return NextResponse.json({ error: 'chat_id + text required' }, { status: 400 })
    
    const r = await sendTelegram(chat_id, text)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 })
  }
}
