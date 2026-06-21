'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { addDays, completionDocId, getAssigneesForTaskOnDate, TaskDoc, todayISO } from '@/lib/schedule'

type UserMap = Record<string, {name:string, roomId?:string|null}>
type RoomMap = Record<string, {name:string}>

export default function TasksPage(){
  const { profile } = useAuthProfile()
  const [tasks, setTasks] = useState<TaskDoc[]>([])
  const [users, setUsers] = useState<UserMap>({})
  const [rooms, setRooms] = useState<RoomMap>({})
  const [completions, setCompletions] = useState<Record<string, boolean>>({})
  const [swaps, setSwaps] = useState<any[]>([])

  const load = async()=>{
    const [tSnap, uSnap, rSnap, cSnap, sSnap] = await Promise.all([
      getDocs(collection(db,'tasks')),
      getDocs(collection(db,'users')),
      getDocs(collection(db,'rooms')),
      getDocs(collection(db,'completions')),
      getDocs(collection(db,'swaps')),
    ])
    setTasks(tSnap.docs.map(d=>({id:d.id, ...d.data()} as TaskDoc)))
    const um:UserMap={}; uSnap.forEach(d=>{ const v=d.data() as any; um[d.id]={name:v.name, roomId:v.roomId}})
    setUsers(um)
    const rm:RoomMap={}; rSnap.forEach(d=> rm[d.id] = {name:(d.data() as any).name})
    setRooms(rm)
    const cm:Record<string,boolean>={}; cSnap.forEach(d=> cm[d.id] = !!(d.data() as any).done)
    setCompletions(cm)
    setSwaps(sSnap.docs.map(d=>({id:d.id, ...d.data()})))
  }
  useEffect(()=>{ load() }, [])

  if(!profile) return null
  const myUid = profile.uid
  const myRoom = profile.roomId

  // show 7 days ago → 14 days forward
  const dates = [...Array(22)].map((_,i)=> addDays(todayISO(), i-7))

  const rows: any[] = []
  tasks.forEach(t=>{
    dates.forEach(date=>{
      getAssigneesForTaskOnDate(t,date).forEach(assignee=>{
        const isMine = (t.assignType==='member' && assignee===myUid) || (t.assignType==='room' && assignee===myRoom)
        if(!isMine) return
        const compId = completionDocId(t.id, date, assignee)
        const done = !!completions[compId]
        const swap = swaps.find(s=>s.taskId===t.id && s.date===date && s.status==='accepted')
        rows.push({t, date, assignee, done, compId, swap})
      })
    })
  })
  rows.sort((a,b)=>b.date.localeCompare(a.date))

  const toggle = async (taskId:string, date:string, assignee:string, done:boolean) => {
    // members can only tick recent tasks (±3 days), older is read-only
    const daysOff = Math.abs(dateDiffDays(date, todayISO()))
    if (profile.role !== 'admin' && daysOff > 3) {
      alert('You can only mark tasks done within ±3 days. Contact admin for older entries.')
      return
    }
    const id = completionDocId(taskId, date, assignee)
    await setDoc(doc(db,'completions', id), {
      taskId, date, assigneeKey: assignee, done: !done, doneBy: myUid, doneAt: new Date().toISOString()
    }, {merge:true})
    setCompletions(c=>({...c, [id]: !done}))
  }

  const upcoming = rows.filter(r=> r.date >= todayISO())
  const past = rows.filter(r=> r.date < todayISO())

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-1">My Tasks</h1>
    <p className="text-slate-500 mb-4">Tick when done. You can see 7 days history. You'll get Telegram notify 7 days before + morning of duty.</p>

    <div className="card overflow-x-auto mb-4">
      <h3 className="font-bold mb-2">Upcoming & Today</h3>
      <table className="w-full min-w-[600px]">
        <thead><tr><th>Date</th><th>Task</th><th>Assignee</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {upcoming.sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{
            const assigneeName = r.t.assignType==='member' ? (users[r.assignee]?.name||r.assignee) : (rooms[r.assignee]?.name||r.assignee)
            return <tr key={r.compId} className={r.date===todayISO() ? 'bg-indigo-50/50':''}>
              <td>{r.date}{r.date===todayISO() && ' • Today'}</td>
              <td><b>{r.t.title}</b><div className="text-slate-500 text-xs">{r.t.description}</div></td>
              <td>{assigneeName}
                {r.swap && <div className="text-[11px] text-amber-700">swapped → {users[r.swap.toUserId]?.name || r.swap.toUserId}</div>}
              </td>
              <td>{r.done ? <span className="pill bg-emerald-100 text-emerald-700">Done</span> : <span className="pill bg-orange-100 text-orange-800">Pending</span>}</td>
              <td className="whitespace-nowrap">
                <button className={`btn !py-1.5 !px-3 text-xs ${r.done?'btn-secondary':''}`} onClick={()=>toggle(r.t.id,r.date,r.assignee,r.done)}>{r.done?'Undo':'Mark done'}</button>
                <a className="btn btn-secondary !py-1.5 !px-3 text-xs ml-2" href={`/swaps?task=${r.t.id}&date=${r.date}`}>Swap</a>
              </td>
            </tr>
          })}
          {upcoming.length===0 && <tr><td colSpan={5} className="text-slate-500">No upcoming tasks.</td></tr>}
        </tbody>
      </table>
    </div>

    <div className="card overflow-x-auto">
      <h3 className="font-bold mb-2">Past 7 Days</h3>
      <table className="w-full min-w-[600px]">
        <thead><tr><th>Date</th><th>Task</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {past.map(r=>(
            <tr key={r.compId} className="opacity-90">
              <td>{r.date}</td>
              <td><b>{r.t.title}</b></td>
              <td>{r.done ? <span className="pill bg-emerald-100 text-emerald-700">Done</span> : <span className="pill bg-slate-200 text-slate-600">Missed</span>}</td>
              <td>
                <button className="btn btn-secondary !py-1 !px-2 text-xs" onClick={()=>toggle(r.t.id,r.date,r.assignee,r.done)} disabled={profile.role!=='admin' && Math.abs(dateDiffDays(r.date, todayISO()))>3}>
                  {r.done?'Undo':'Mark done'}
                </button>
              </td>
            </tr>
          ))}
          {past.length===0 && <tr><td colSpan={4} className="text-slate-500">No tasks in the past week.</td></tr>}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">You can edit completions within ±3 days. Older entries: contact admin.</p>
    </div>
  </AppShell>
}

function dateDiffDays(a:string,b:string){ return Math.round((new Date(a+'T12:00:00').getTime() - new Date(b+'T12:00:00').getTime())/86400000)}
