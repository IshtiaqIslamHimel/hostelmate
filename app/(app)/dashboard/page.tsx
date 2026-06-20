'use client'
import AppShell from '@/components/AppShell'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebaseClient'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getAssigneesForTaskOnDate, todayISO, TaskDoc } from '@/lib/schedule'
import Link from 'next/link'

export default function Dashboard(){
  const [stats,setStats] = useState({rooms:0, members:0, tasks:0, dueToday:0})
  useEffect(()=>{
    (async ()=>{
      const [roomsSnap, usersSnap, tasksSnap] = await Promise.all([
        getDocs(collection(db,'rooms')),
        getDocs(query(collection(db,'users'), where('role','==','member'))),
        getDocs(collection(db,'tasks')),
      ])
      const tasks = tasksSnap.docs.map(d=>({id:d.id, ...d.data()} as TaskDoc))
      const today = todayISO()
      let due=0
      tasks.forEach(t=> due += getAssigneesForTaskOnDate(t, today).length)
      setStats({rooms: roomsSnap.size, members: usersSnap.size, tasks: tasks.length, dueToday: due})
    })()
  },[])

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-1">Dashboard</h1>
    <p className="text-slate-500 mb-4">Quick overview</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {[
        ['Rooms', stats.rooms],
        ['Members', stats.members],
        ['Active Tasks', stats.tasks],
        ['Due Today', stats.dueToday],
      ].map(([l,v])=> <div key={l as string} className="card"><div className="text-3xl font-extrabold">{v as number}</div><div className="text-slate-500 text-sm">{l}</div></div>)}
    </div>
    <div className="card">
      <h3 className="font-bold mb-2">Go to</h3>
      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-secondary" href="/tasks">My Tasks</Link>
        <Link className="btn btn-secondary" href="/food">Food / Meal</Link>
        <Link className="btn btn-secondary" href="/swaps">Swaps</Link>
      </div>
    </div>
  </AppShell>
}
