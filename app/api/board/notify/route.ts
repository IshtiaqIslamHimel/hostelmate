import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { sendTelegram } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })
    await adminAuth.verifyIdToken(token)

    const { text, authorName } = await req.json()
    const groupId = process.env.TELEGRAM_GROUP_CHAT_ID
    if (!groupId) return NextResponse.json({ error: 'TELEGRAM_GROUP_CHAT_ID not set on server', telegram: { ok:false, error:'TELEGRAM_GROUP_CHAT_ID not set'} }, { status: 500 })
    
    const r = await sendTelegram(groupId, `💬 <b>${authorName}</b>\n\n${text.slice(0, 3500)}`)
    return NextResponse.json({ ok: r.ok, telegram: r })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, telegram: { ok:false, error: e.message } }, { status: 500 })
  }
}