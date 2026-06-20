import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { sendTelegram } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'No auth token' }, { status: 401 })
    await adminAuth.verifyIdToken(token, true)

    const { chat_id } = await req.json().catch(()=>({}))
    let target = chat_id
    if (!target) {
      // send to self
      const decoded = await adminAuth.verifyIdToken(token, true)
      const snap = await adminDb.collection('users').doc(decoded.uid).get()
      target = snap.data()?.telegram_chat_id
      if (!target) return NextResponse.json({ error: 'No telegram_chat_id on your profile. Set it in Admin → Members, or use the Link Telegram button on the Board page.' }, { status: 400 })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    if (!botToken) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set on server. Add it in Vercel env / .env.local and restart.' }, { status: 500 })

    const r = await sendTelegram(target, `✅ <b>HostelMate Telegram Test</b>\n\nIf you see this, notifications are working!\nChat ID: <code>${target}</code>\nTime: ${new Date().toLocaleString('en-GB', {timeZone: 'Asia/Dhaka'})} Asia/Dhaka`)
    if (!r.ok) return NextResponse.json({ error: r.error || 'send failed', chat_id: target, token_present: !!botToken }, { status: 500 })
    return NextResponse.json({ ok: true, chat_id: target })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET is useful for quick cron / health checks
export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ ok:false, error:'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  // verify bot token is valid
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
  const j = await res.json()
  if (!j.ok) return NextResponse.json({ ok:false, error: j.description || 'invalid bot token' }, { status: 500 })
  return NextResponse.json({ ok:true, bot: j.result.username })
}
