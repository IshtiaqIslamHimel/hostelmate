'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { addDays, completionDocId, getAssigneesForTaskOnDate, TaskDoc, todayISO, getFineForTask, taskIsFuture, taskIsOverdue } from '@/lib/schedule'
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
  const today = todayISO()

  // 7 days ago → 14 days forward
  const dates = [...Array(22)].map((_,i)=> addDays(today, i-7))

  const rows: any[] = []
  tasks.forEach(t=>{
    dates.forEach(date=>{
      getAssigneesForTaskOnDate(t, date).forEach(originalAssignee=>{
        const eff = resolveEffective(t, date, originalAssignee, swaps, users)
        const mine = isDutyMine(eff.kind, eff.id, myUid, myRoom)
        if(!mine) return

        const compId = completionDocId(t.id, date, originalAssignee)
        const done = !!completions[compId]
        const future = taskIsFuture(date, today)
        const overdue = taskIsOverdue(date, today) && !done
        const fine = getFineForTask(t, date, done, today)

        rows.push({ t, date, originalAssignee, effectiveKind: eff.kind, effectiveId: eff.id, swap: eff.swap, done, compId, future, overdue, fine })
      })
    })
  })
  rows.sort((a,b)=>b.date.localeCompare(a.date))

  const toggle = async (taskId:string, date:string, originalAssignee:string, done:boolean, future:boolean) => {
    // 1. cannot mark before due date
    if (future && profile.role !== 'admin') {
      alert('You cannot mark a task done before its due date.')
      return
    }
    // 2. edit window = 1 day
    const daysOff = Math.abs(dateDiffDays(date, today))
    if (profile.role !== 'admin' && daysOff > 1) {
      alert('You can only edit task completion within 1 day of the due date. Contact admin for older entries.')
      return
    }
    const id = completionDocId(taskId, date, originalAssignee)
    await setDoc(doc(db,'completions', id), {
      taskId, date, assigneeKey: originalAssignee, done: !done,
      doneBy: myUid, doneAt: new Date().toISOString()
    }, {merge:true})
    setCompletions(c=>({...c, [id]: !done}))
  }

  const upcoming = rows.filter(r=> r.date >= today)
  const past = rows.filter(r=> r.date < today)
  const totalFine = rows.filter(r=>r.overdue).reduce((s,r)=> s + (r.fine||0), 0)

  const renderRows = (list:any[]) => list.sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{
    const originalName = assigneeDisplay(r.t.assignType, r.originalAssignee, users, rooms)
    const effectiveName = r.effectiveKind === 'member'
      ? users[r.effectiveId]?.name || r.effectiveId
      : rooms[r.effectiveId]?.name || r.effectiveId
    const swapped = !!r.swap
    const canClick = !r.future || profile.role === 'admin'
    return <tr key={r.compId} className={r.date===today ? 'bg-indigo-50/50': r.overdue ? 'bg-red-50/40' : ''}>
      <td>{r.date}{r.date===today && ' • Today'}</td>
      <td>
        <b>{r.t.title}</b>
        <div className="text-slate-500 text-xs">{r.t.description}</div>
        {swapped && <div className="text-[11px] text-amber-700">Swapped from {originalName}</div>}
        {r.overdue && <div className="text-[11px] text-red-600 font-bold">Overdue – Fine ৳{r.fine}</div>}
        {r.future && <div className="text-[11px] text-slate-500">Not due yet</div>}
      </td>
      <td>{swapped ? effectiveName : originalName}</td>
      <td>{r.done ? <span className="pill bg-emerald-100 text-emerald-700">Done</span> :
           r.overdue ? <span className="pill bg-red-100 text-red-700">Fine ৳{r.fine}</span> :
           r.future ? <span className="pill bg-slate-200 text-slate-600">Upcoming</span> :
           <span className="pill bg-orange-100 text-orange-800">Pending</span>}</td>
      <td className="whitespace-nowrap">
        <button
          className={`btn !py-1.5 !px-3 text-xs ${r.done?'btn-secondary':''} disabled:opacity-40`}
          disabled={!canClick}
          title={r.future ? 'Cannot mark done before due date' : ''}
          onClick={()=>toggle(r.t.id,r.date,r.originalAssignee,r.done, r.future)}
        >{r.done?'Undo':'Mark done'}</button>
        {!swapped && !r.done && <a className="btn btn-secondary !py-1.5 !px-3 text-xs ml-2" href={`/swaps?task=${r.t.id}&date=${r.date}`}>Swap</a>}
      </td>
    </tr>
  })

  return <AppShell>
    <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
      <h1 className="text-2xl font-extrabold">My Tasks</h1>
      {totalFine > 0 && <div className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-sm font-bold">Total Fine: ৳{totalFine}</div>}
    </div>
    <p className="text-slate-500 mb-4">Mark done on/after due date only. Edit allowed within 1 day. Missed = fine. Telegram notify: task created • 7 days before • morning of duty.</p>

    <div className="card overflow-x-auto mb-4">
      <h3 className="font-bold mb-2">Upcoming & Today</h3>
      <table className="w-full min-w-[760px]">
        <thead><tr><th>Date</th><th>Task</th><th>Assignee</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {renderRows(upcoming)}
          {upcoming.length===0 && <tr><td colSpan={5} className="text-slate-500">No upcoming tasks.</td></tr>}
        </tbody>
      </table>
    </div>

    <div className="card overflow-x-auto">
      <h3 className="font-bold mb-2">Past 7 Days</h3>
      <table className="w-full min-w-[760px]">
        <thead><tr><th>Date</th><th>Task</th><th>Assignee</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {renderRows(past)}
          {past.length===0 && <tr><td colSpan={5} className="text-slate-500">No tasks in the past week.</td></tr>}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">Mark-done allowed only on/after due date, and within 1 day. Overdue unfinished tasks accrue the fine set by admin.</p>
    </div>
  </AppShell>
}

function dateDiffDays(a:string,b:string){ return Math.round((new Date(a+'T12:00:00').getTime() - new Date(b+'T12:00:00').getTime())/86400000)}