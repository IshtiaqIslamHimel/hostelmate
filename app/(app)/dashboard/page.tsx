'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebaseClient'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { getAssigneesForTaskOnDate, todayISO, TaskDoc, completionDocId } from '@/lib/schedule'
import { resolveEffective as resolveSwap, assigneeDisplay } from '@/lib/swap'
import Link from 'next/link'

export default function Dashboard(){
  const { profile } = useAuthProfile()
  const [stats,setStats] = useState({rooms:0, members:0, tasks:0, dueToday:0})
  const [todayList, setTodayList] = useState<any[]>([])
  const [users,setUsers] = useState<Record<string,any>>({})
  const [rooms,setRooms] = useState<Record<string,any>>({})

  const load = async () => {
    const [roomsSnap, usersSnap, tasksSnap, compSnap, swapSnap] = await Promise.all([
      getDocs(collection(db,'rooms')),
      getDocs(collection(db,'users')),
      getDocs(collection(db,'tasks')),
      getDocs(collection(db,'completions')),
      getDocs(collection(db,'swaps')),
    ])
    const usersMap:Record<string,any> = {}; usersSnap.forEach(d=> usersMap[d.id] = d.data()); setUsers(usersMap)
    const roomsMap:Record<string,any> = {}; roomsSnap.forEach(d=> roomsMap[d.id] = d.data()); setRooms(roomsMap)
    const tasks = tasksSnap.docs.map(d=>({id:d.id, ...d.data()} as TaskDoc))
    const completions: Record<string, boolean> = {}; compSnap.forEach(d=> completions[d.id] = !!(d.data() as any).done)
    const swaps = swapSnap.docs.map(d=> ({id:d.id, ...d.data()} as any))

    const today = todayISO()
    let due = 0
    const list: any[] = []
    tasks.forEach(t=>{
      getAssigneesForTaskOnDate(t, today).forEach(originalAssignee=>{
        due++
        const eff = resolveSwap(t, today, originalAssignee, swaps, usersMap as any)
        const compId = completionDocId(t.id, today, originalAssignee)
        const done = !!completions[compId]
        list.push({
          task: t,
          originalAssignee,
          effectiveKind: eff.kind,
          effectiveId: eff.id,
          swap: eff.swap,
          done,
          compId,
        })
      })
    })
    setStats({rooms: roomsSnap.size, members: usersSnap.size, tasks: tasks.length, dueToday: due})
    setTodayList(list)
  }

  useEffect(()=>{ load() },[])

  const toggle = async (taskId:string, date:string, originalAssignee:string, done:boolean) => {
    if(!profile) return
    const id = completionDocId(taskId, date, originalAssignee)
    await setDoc(doc(db,'completions', id), {
      taskId, date, assigneeKey: originalAssignee, done: !done,
      doneBy: profile.uid, doneAt: new Date().toISOString()
    }, {merge:true})
    load()
  }

  const canMark = (task:any, originalAssignee:string, effectiveKind:string, effectiveId:string) => {
    if(!profile) return false
    if(profile.role==='admin') return true
    if(effectiveKind==='member') return effectiveId === profile.uid
    // room task: any member in that room
    const roomMembers = Object.entries(users).filter(([uid,u]:any)=>u.roomId===effectiveId).map(([uid])=>uid)
    return roomMembers.includes(profile.uid)
  }

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-1">Dashboard</h1>
    <p className="text-slate-500 mb-4">Quick overview</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {[
        ['Rooms', stats.rooms],
        ['People', stats.members],
        ['Active Tasks', stats.tasks],
        ['Due Today', stats.dueToday],
      ].map(([l,v])=> <div key={l as string} className="card"><div className="text-3xl font-extrabold">{v as number}</div><div className="text-slate-500 text-sm">{l}</div></div>)}
    </div>
    <div className="grid lg:grid-cols-3 gap-3">
      <div className="card lg:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold">Today's Duty Roster</h3>
          <span className="text-xs text-slate-500">{todayISO()}</span>
        </div>
        {todayList.length===0 && <div className="text-slate-500 text-sm">No tasks today.</div>}
        <div className="space-y-2">
          {todayList.map(item=>{
            const originalName = assigneeDisplay(item.task.assignType, item.originalAssignee, users, rooms)
            const effectiveName = assigneeDisplay(item.effectiveKind as any, item.effectiveId, users, rooms)
            const swapped = !!item.swap
            const allow = canMark(item.task, item.originalAssignee, item.effectiveKind, item.effectiveId)
            return (
              <div key={item.compId} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <input type="checkbox" checked={item.done} disabled={!allow}
                  onChange={()=>toggle(item.task.id, todayISO(), item.originalAssignee, item.done)} />
                <div className="flex-1">
                  <b>{item.task.title}</b>
                  <div className="text-xs text-slate-500">
                    {swapped ? <>{effectiveName} <span className="text-amber-700">(swapped from {originalName})</span></> : originalName}
                  </div>
                </div>
                <span className={`pill ${item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-800'}`}>{item.done ? 'Done':'Pending'}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="card">
        <h3 className="font-bold mb-2">Quick Links</h3>
        <div className="flex flex-col gap-2 text-sm">
          <Link className="btn btn-secondary" href="/tasks">My Tasks</Link>
          <Link className="btn btn-secondary" href="/food">Food / Meal</Link>
          <Link className="btn btn-secondary" href="/swaps">Swaps</Link>
          <Link className="btn btn-secondary" href="/board">Board</Link>
        </div>
      </div>
    </div>
  </AppShell>
}
