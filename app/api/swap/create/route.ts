import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { sendTelegram } from '@/lib/telegram'

function dateDiff(a:string,b:string){ return Math.round((new Date(a+'T12:00:00').getTime() - new Date(b+'T12:00:00').getTime())/86400000) }
function getAssignees(task:any, dateStr:string){
  const targets = task.targets || []
  if (!targets.length) return []
  const interval = task.repeat==='once'?99999 : task.repeat==='daily'?1 : task.repeat==='weekly'?7 : (task.intervalDays||1)
  const daysSince = dateDiff(dateStr, task.startDate)
  if (daysSince < 0) return []
  if (task.repeat==='once' && daysSince!==0) return []
  if (daysSince % interval !== 0) return []
  if (task.rotation==='all') return targets
  const cycle = Math.floor(daysSince/interval)
  return [targets[cycle % targets.length]]
}

export async function POST(req: NextRequest){
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({error:'No auth token'}, {status:401})
    const decoded = await adminAuth.verifyIdToken(token, true)
    const requesterUid = decoded.uid
    const isAdmin = (decoded as any).role === 'admin'

    const { taskId, date, fromUserId, toUserId } = await req.json()
    if (!taskId || !date || !fromUserId || !toUserId) return NextResponse.json({error:'taskId, date, fromUserId, toUserId required'}, {status:400})
    if (fromUserId === toUserId) return NextResponse.json({error:'Cannot swap with yourself'}, {status:400})

    const [fromSnap, toSnap, taskSnap] = await Promise.all([
      adminDb.collection('users').doc(fromUserId).get(),
      adminDb.collection('users').doc(toUserId).get(),
      adminDb.collection('tasks').doc(taskId).get(),
    ])
    if (!fromSnap.exists) return NextResponse.json({error:'fromUser not found'}, {status:400})
    if (!toSnap.exists) return NextResponse.json({error:'toUser not found'}, {status:400})
    if (!taskSnap.exists) return NextResponse.json({error:'task not found'}, {status:400})
    const task = taskSnap.data()!
    const fromUser = fromSnap.data()!
    const toUser = toSnap.data()!

    if (!isAdmin) {
      if (fromUserId !== requesterUid) {
        return NextResponse.json({error:'Members can only swap their own tasks'}, {status:403})
      }
      const assignees = getAssignees(task, date)
      let isAssigned = false
      if (task.assignType === 'member') {
        isAssigned = assignees.includes(fromUserId)
      } else {
        isAssigned = assignees.includes(fromUser.roomId)
      }
      if (!isAssigned) {
        return NextResponse.json({error:'You are not assigned to this task on this date'}, {status:403})
      }
    }

    const existing = await adminDb.collection('swaps')
      .where('taskId','==',taskId)
      .where('date','==',date)
      .where('fromUserId','==',fromUserId)
      .where('toUserId','==',toUserId)
      .where('status','==','pending')
      .get()
    if (!existing.empty) {
      return NextResponse.json({error:'Swap request already pending'}, {status:409})
    }

    const ref = await adminDb.collection('swaps').add({
      taskId, date, fromUserId, toUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      createdBy: requesterUid,
    })

    // Telegram notify toUser
    let telegram = { sent: false }
    if (toUser.telegram_chat_id) {
      const r = await sendTelegram(
        toUser.telegram_chat_id,
        `🔄 <b>Swap Request – HostelMate</b>\n\n${fromUser.name} wants to swap:\n<b>${task.title}</b>\nDate: ${date}\n\nOpen the app → Swaps to Accept / Reject.`
      )
      telegram.sent = r.ok
    }

    return NextResponse.json({ok:true, id: ref.id, telegram})
  } catch (e:any) {
    return NextResponse.json({error: e.message || 'failed'}, {status:500})
  }
}
