import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { sendTelegram } from '@/lib/telegram'

export async function POST(req: NextRequest){
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({error:'No auth token'}, {status:401})
    const decoded = await adminAuth.verifyIdToken(token, true)
    const uid = decoded.uid
    const isAdmin = (decoded as any).role === 'admin'

    const { swapId, accept } = await req.json()
    if (!swapId) return NextResponse.json({error:'swapId required'}, {status:400})

    const snap = await adminDb.collection('swaps').doc(swapId).get()
    if (!snap.exists) return NextResponse.json({error:'Swap not found'}, {status:404})
    const s = snap.data()!

    if (s.status !== 'pending') return NextResponse.json({error:'Swap already resolved'}, {status:400})
    if (!isAdmin && s.toUserId !== uid) {
      return NextResponse.json({error:'Only the requested member or admin can respond'}, {status:403})
    }

    await adminDb.collection('swaps').doc(swapId).update({
      status: accept ? 'accepted' : 'rejected',
      resolvedAt: new Date().toISOString(),
      resolvedBy: uid,
    })

    const [fromSnap, taskSnap] = await Promise.all([
      adminDb.collection('users').doc(s.fromUserId).get(),
      adminDb.collection('tasks').doc(s.taskId).get(),
    ])
    const fromUser = fromSnap.data()
    const task = taskSnap.data()
    let telegram = { sent: false }
    if (fromUser?.telegram_chat_id) {
      const r = await sendTelegram(
        fromUser.telegram_chat_id,
        accept
          ? `✅ <b>Swap Accepted</b>\n${task?.title || 'Task'} – ${s.date}\nYour swap request was accepted.`
          : `❌ <b>Swap Rejected</b>\n${task?.title || 'Task'} – ${s.date}\nYour swap request was rejected.`
      )
      telegram.sent = r.ok
    }

    return NextResponse.json({ok:true, telegram})
  } catch (e:any) {
    return NextResponse.json({error: e.message || 'failed'}, {status:500})
  }
}
