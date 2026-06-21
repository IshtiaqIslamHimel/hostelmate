import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { sendTelegram } from '@/lib/telegram'

function todayISO(){ return new Date().toISOString().slice(0,10) }
function dateDiff(a:string,b:string){ return Math.round((new Date(a+'T12:00:00').getTime() - new Date(b+'T12:00:00').getTime())/86400000) }
function addDays(s:string, n:number){ const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10) }

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

export async function GET(req: NextRequest){
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  if (secret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({error:'unauthorized'}, {status:401})
  }

  const today = todayISO()
  const advanceDate = addDays(today, 7)

  const tasksSnap = await adminDb.collection('tasks').get()
  const usersSnap = await adminDb.collection('users').get()
  const usersMap: any = {}
  usersSnap.forEach(d=> usersMap[d.id] = d.data())

  type Duty = { title: string, date: string, assignType: string }
  const dutiesToday: Record<string, Duty[]> = {}
  const dutiesAdvance: Record<string, Duty[]> = {}

  const collect = (dateStr: string, bucket: Record<string, Duty[]>) => {
    tasksSnap.forEach(tDoc=>{
      const t = {id: tDoc.id, ...tDoc.data()} as any
      const assignees = getAssignees(t, dateStr)
      assignees.forEach((assignee:string)=>{
        if(t.assignType==='member'){
          bucket[assignee] = bucket[assignee] || []
          bucket[assignee].push({ title: t.title, date: dateStr, assignType: t.assignType })
        } else {
          // room task -> notify all members in that room
          Object.entries(usersMap).forEach(([uid, u]:any)=>{
            if(u.roomId === assignee){
              bucket[uid] = bucket[uid] || []
              bucket[uid].push({ title: `${t.title} (${usersMap[assignee]?.name||assignee})`, date: dateStr, assignType: t.assignType })
            }
          })
        }
      })
    })
  }

  collect(today, dutiesToday)
  collect(advanceDate, dutiesAdvance)

  let sentToday = 0, sentAdvance = 0

  // Morning reminder – today
  for(const [uid, taskList] of Object.entries(dutiesToday)){
    const u = usersMap[uid]
    if(!u?.telegram_chat_id) continue
    const text = `🔔 <b>HostelMate – Duty Today</b>\n${taskList.map(x=>`• ${x.title}`).join('\n')}\n\nMark done in the app!`
    const r = await sendTelegram(u.telegram_chat_id, text)
    if(r.ok) sentToday++
  }

  // 7-day advance notice
  for(const [uid, taskList] of Object.entries(dutiesAdvance)){
    const u = usersMap[uid]
    if(!u?.telegram_chat_id) continue
    const text = `📅 <b>Upcoming Duty – 7 days notice</b>\nDate: ${advanceDate}\n${taskList.map(x=>`• ${x.title}`).join('\n')}\n\nYou can swap in the app if needed.`
    const r = await sendTelegram(u.telegram_chat_id, text)
    if(r.ok) sentAdvance++
  }

  return NextResponse.json({ ok:true, date: today, sent_today: sentToday, sent_advance_7d: sentAdvance, advance_date: advanceDate })
}
