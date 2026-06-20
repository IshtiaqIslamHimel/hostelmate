import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

function todayISO(){ return new Date().toISOString().slice(0,10) }
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

export async function GET(req: NextRequest){
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  if (secret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({error:'unauthorized'}, {status:401})
  }
  const token = process.env.TELEGRAM_BOT_TOKEN
  if(!token) return NextResponse.json({error:'no telegram token'}, {status:500})

  const today = todayISO()
  const tasksSnap = await adminDb.collection('tasks').get()
  const usersSnap = await adminDb.collection('users').get()
  const usersMap: any = {}
  usersSnap.forEach(d=> usersMap[d.id] = d.data())

  // collect duties per member
  const duties: Record<string, string[]> = {}
  tasksSnap.forEach(tDoc=>{
    const t = {id: tDoc.id, ...tDoc.data()} as any
    const assignees = getAssignees(t, today)
    assignees.forEach((assignee:string)=>{
      if(t.assignType==='member'){
        duties[assignee] = duties[assignee] || []; duties[assignee].push(t.title)
      } else {
        // room task -> notify all members in that room
        Object.entries(usersMap).forEach(([uid, u]:any)=>{
          if(u.roomId === assignee){
            duties[uid] = duties[uid] || []; duties[uid].push(`${t.title} (${usersMap[assignee]?.name||assignee})`)
          }
        })
      }
    })
  })

  let sent = 0
  for(const [uid, taskList] of Object.entries(duties)){
    const u = usersMap[uid]
    if(!u?.telegram_chat_id) continue
    const text = `🔔 <b>HostelMate Duty Today</b>\n${taskList.map(x=>`• ${x}`).join('\n')}\n\nMark done in the app!`
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: u.telegram_chat_id, text, parse_mode: 'HTML'})
    })
    sent++
  }
  return NextResponse.json({ ok:true, sent, date: today })
}
