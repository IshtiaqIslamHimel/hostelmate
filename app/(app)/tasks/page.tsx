'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { addDays, completionDocId, getAssigneesForTaskOnDate, TaskDoc, todayISO } from '@/lib/schedule'
import { resolveEffective, isDutyMine, assigneeDisplay, type SwapDoc } from '@/lib/swap'

type UserMap = Record<string, {name:string, roomId?:string|null}>
type RoomMap = Record<string, {name:string}>

export default function TasksPage(){
  const { profile } = useAuthProfile()
  const [tasks, setTasks] = useState<TaskDoc[]>([])
  const [users, setUsers] = useState<UserMap>({})
  const [rooms, setRooms] = useState<RoomMap>({})
  const [completions, setCompletions] = useState<Record<string, boolean>>({})
  const [swaps, setSwaps] = useState<SwapDoc[]>([])

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
    setSwaps(sSnap.docs.map(d=>({id:d.id, ...d.data()} as SwapDoc)))
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
      getAssigneesForTaskOnDate(t, date).forEach(originalAssignee=>{
        const eff = resolveEffective(t, date, originalAssignee, swaps, users)
        const mine = isDutyMine(eff.kind, eff.id, myUid, myRoom)
        if(!mine) return

        const compId = completionDocId(t.id, date, originalAssignee)
        const done = !!completions[compId]
        rows.push({
          t, date,
          originalAssignee,
          effectiveKind: eff.kind,
          effectiveId: eff.id,
          swap: eff.swap,
          done, compId
        })
      })
    })
  })
  rows.sort((a,b)=>b.date.localeCompare(a.date))

  const toggle = async (taskId:string, date:string, originalAssignee:string, done:boolean) => {
    const daysOff = Math.abs(dateDiffDays(date, todayISO()))
    if (profile.role !== 'admin' && daysOff > 3) {
      alert('You can only mark tasks done within ±3 days. Contact admin for older entries.')
      return
    }
    const id = completionDocId(taskId, date, originalAssignee)
    await setDoc(doc(db,'completions', id), {
      taskId, date, assigneeKey: originalAssignee, done: !done,
      doneBy: myUid, doneAt: new Date().toISOString()
    }, {merge:true})
    setCompletions(c=>({...c, [id]: !done}))
  }

  const upcoming = rows.filter(r=> r.date >= todayISO())
  const past = rows.filter(r=> r.date < todayISO())

  const renderRows = (list:any[]) => list.sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{
    const originalName = assigneeDisplay(r.t.assignType, r.originalAssignee, users, rooms)
    const effectiveName = r.effectiveKind === 'member'
      ? users[r.effectiveId]?.name || r.effectiveId
      : rooms[r.effectiveId]?.name || r.effectiveId
    const swapped = !!r.swap
    return <tr key={r.compId} className={r.date===todayISO() ? 'bg-indigo-50/50':''}>
      <td>{r.date}{r.date===todayISO() && ' • Today'}</td>
      <td>
        <b>{r.t.title}</b>
        <div className="text-slate-500 text-xs">{r.t.description}</div>
        {swapped && <div className="text-[11px] text-amber-700">Swapped from {originalName} → {effectiveName}</div>}
      </td>
      <td>
        {swapped ? effectiveName : originalName}
        {swapped && <div className="text-[11px] text-slate-500">orig: {originalName}</div>}
      </td>
      <td>{r.done ? <span className="pill bg-emerald-100 text-emerald-700">Done</span> : <span className="pill bg-orange-100 text-orange-800">Pending</span>}</td>
      <td className="whitespace-nowrap">
        <button className={`btn !py-1.5 !px-3 text-xs ${r.done?'btn-secondary':''}`} onClick={()=>toggle(r.t.id,r.date,r.originalAssignee,r.done)}>{r.done?'Undo':'Mark done'}</button>
        {!swapped && <a className="btn btn-secondary !py-1.5 !px-3 text-xs ml-2" href={`/swaps?task=${r.t.id}&date=${r.date}`}>Swap</a>}
      </td>
    </tr>
  })

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-1">My Tasks</h1>
    <p className="text-slate-500 mb-4">Includes tasks swapped to you. Original assignee is shown for audit. ±3 day edit window.</p>

    <div className="card overflow-x-auto mb-4">
      <h3 className="font-bold mb-2">Upcoming & Today</h3>
      <table className="w-full min-w-[720px]">
        <thead><tr><th>Date</th><th>Task</th><th>Assignee</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {renderRows(upcoming)}
          {upcoming.length===0 && <tr><td colSpan={5} className="text-slate-500">No upcoming tasks.</td></tr>}
        </tbody>
      </table>
    </div>

    <div className="card overflow-x-auto">
      <h3 className="font-bold mb-2">Past 7 Days</h3>
      <table className="w-full min-w-[720px]">
        <thead><tr><th>Date</th><th>Task</th><th>Assignee</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {renderRows(past)}
          {past.length===0 && <tr><td colSpan={5} className="text-slate-500">No tasks in the past week.</td></tr>}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">You can edit completions within ±3 days. Older entries: contact admin.</p>
    </div>
  </AppShell>
}

function dateDiffDays(a:string,b:string){ return Math.round((new Date(a+'T12:00:00').getTime() - new Date(b+'T12:00:00').getTime())/86400000)}
