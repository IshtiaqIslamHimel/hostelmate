import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, requireAdmin } from '@/lib/firebaseAdmin'
import { sendTelegram } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json()
    const {
      title, description = '',
      assignType, targets,
      rotation = 'round_robin',
      repeat = 'weekly',
      intervalDays = 7,
      startDate,
      fineAmount = 0,
    } = body

    if (!title || !Array.isArray(targets) || targets.length === 0 || !startDate)
      return NextResponse.json({ error: 'title, targets[], startDate required' }, { status: 400 })

    const taskDoc = {
      title: String(title).slice(0,120),
      description: String(description).slice(0,500),
      assignType: assignType === 'room' ? 'room' : 'member',
      targets,
      rotation: rotation === 'all' ? 'all' : 'round_robin',
      repeat,
      intervalDays: Number(intervalDays) || 7,
      startDate,
      fineAmount: Number(fineAmount) || 0,
      createdAt: new Date().toISOString(),
    }

    const ref = await adminDb.collection('tasks').add(taskDoc)

    // ---- Telegram notify assigned people ----
    // collect user IDs to notify
    let userIds: string[] = []
    if (taskDoc.assignType === 'member') {
      userIds = targets
    } else {
      // room-wise: find all users in those rooms
      const usersSnap = await adminDb.collection('users').get()
      usersSnap.forEach(d => {
        const u = d.data()
        if (u.roomId && targets.includes(u.roomId)) userIds.push(d.id)
      })
      userIds = [...new Set(userIds)]
    }

    let notified = 0
    const firstDue = startDate
    const repeatText = repeat === 'once' ? 'One-time' :
      repeat === 'daily' ? 'Daily' :
      repeat === 'weekly' ? 'Weekly' :
      `Every ${intervalDays} days`
    const fineText = taskDoc.fineAmount > 0 ? `\nFine if missed: ৳${taskDoc.fineAmount}` : ''

    for (const uid of userIds) {
      const uSnap = await adminDb.collection('users').doc(uid).get()
      const u = uSnap.data()
      if (!u?.telegram_chat_id) continue
      const r = await sendTelegram(u.telegram_chat_id,
        `🆕 <b>New Duty Assigned</b>\n\n<b>${taskDoc.title}</b>\n${taskDoc.description ? taskDoc.description + '\n' : ''}\nFirst duty: ${firstDue}\nRepeat: ${repeatText}${fineText}\n\nCheck HostelMate → My Tasks`
      )
      if (r.ok) notified++
    }

    // group announcement
    const groupId = process.env.TELEGRAM_GROUP_CHAT_ID
    let group_posted = false
    if (groupId) {
      const gr = await sendTelegram(groupId,
        `📋 <b>New Task: ${taskDoc.title}</b>\nStart: ${firstDue} · ${repeatText}${fineText ? `\nFine: ৳${taskDoc.fineAmount}` : ''}`
      )
      group_posted = gr.ok
    }

    return NextResponse.json({ ok: true, id: ref.id, notified, group_posted })
  } catch (e: any) {
    const msg = e.message || 'failed'
    const status = msg.includes('Admin') ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}