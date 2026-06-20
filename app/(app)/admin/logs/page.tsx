'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { useEffect, useState } from 'react'

type Comp = {
  id: string
  taskId: string
  date: string
  assigneeKey: string
  done: boolean
  doneBy?: string
  doneAt?: string
}

export default function AdminLogs(){
  const { profile } = useAuthProfile()
  const [comps, setComps] = useState<Comp[]>([])
  const [tasks, setTasks] = useState<Record<string, any>>({})
  const [users, setUsers] = useState<Record<string, any>>({})
  const [rooms, setRooms] = useState<Record<string, any>>({})
  const [swaps, setSwaps] = useState<any[]>([])
  const [filter, setFilter] = useState({ member: '', status: 'all', dateFrom: '' })

  const load = async () => {
    const [cSnap, tSnap, uSnap, rSnap, sSnap] = await Promise.all([
      getDocs(query(collection(db,'completions'), orderBy('doneAt', 'desc'))).catch(async ()=> await getDocs(collection(db,'completions'))),
      getDocs(collection(db,'tasks')),
      getDocs(collection(db,'users')),
      getDocs(collection(db,'rooms')),
      getDocs(collection(db,'swaps')),
    ])
    const cs = cSnap.docs.map(d=> ({id:d.id, ...d.data()} as Comp)).sort((a,b)=> (b.doneAt||'').localeCompare(a.doneAt||''))
    setComps(cs)
    const tm:Record<string,any>={}; tSnap.forEach(d=> tm[d.id]=d.data()); setTasks(tm)
    const um:Record<string,any>={}; uSnap.forEach(d=> um[d.id]=d.data()); setUsers(um)
    const rm:Record<string,any>={}; rSnap.forEach(d=> rm[d.id]=d.data()); setRooms(rm)
    setSwaps(sSnap.docs.map(d=>({id:d.id, ...d.data()})))
  }
  useEffect(()=>{ load() },[])

  if(profile?.role!=='admin') return <AppShell><div>Admin only</div></AppShell>

  const doneByName = (uid?:string) => users[uid||'']?.name || uid || '—'
  const assigneeName = (taskId:string, key:string) => {
    const t = tasks[taskId]
    if (!t) return key
    if (t.assignType === 'member') return users[key]?.name || key
    return rooms[key]?.name || key
  }
  const swapInfo = (taskId:string, date:string) => {
    const s = swaps.find(x=>x.taskId===taskId && x.date===date && x.status==='accepted')
    if(!s) return null
    return `swapped → ${users[s.toUserId]?.name || s.toUserId}`
  }

  const filtered = comps.filter(c=>{
    if (filter.status==='done' && !c.done) return false
    if (filter.status==='pending' && c.done) return false
    if (filter.member){
      const an = assigneeName(c.taskId, c.assigneeKey).toLowerCase()
      if (!an.includes(filter.member.toLowerCase()) && c.assigneeKey !== filter.member) return false
    }
    if (filter.dateFrom && c.date < filter.dateFrom) return false
    return true
  })

  const todayStr = new Date().toISOString().slice(0,10)
  const todayDone = comps.filter(c=>c.date===todayStr && c.done).length
  const todayTotal = comps.filter(c=>c.date===todayStr).length

  return <AppShell>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h1 className="text-2xl font-extrabold">Task Logs</h1>
        <p className="text-slate-500 text-sm">Who marked what done, and when. Full audit trail.</p>
      </div>
      <button className="btn btn-secondary" onClick={load}>Refresh</button>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div className="card"><div className="text-2xl font-extrabold">{comps.filter(c=>c.done).length}</div><div className="text-slate-500 text-sm">Total Done</div></div>
      <div className="card"><div className="text-2xl font-extrabold">{comps.length}</div><div className="text-slate-500 text-sm">Total Records</div></div>
      <div className="card"><div className="text-2xl font-extrabold">{todayDone}/{todayTotal||'0'}</div><div className="text-slate-500 text-sm">Today</div></div>
      <div className="card"><div className="text-2xl font-extrabold">{swaps.filter(s=>s.status==='accepted').length}</div><div className="text-slate-500 text-sm">Swaps Accepted</div></div>
    </div>

    <div className="card mb-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div><label className="label">Member / Room search</label><input className="input w-56" placeholder="Rakib / Room 101" value={filter.member} onChange={e=>setFilter({...filter, member:e.target.value})} /></div>
        <div><label className="label">Status</label>
          <select className="input" value={filter.status} onChange={e=>setFilter({...filter, status:e.target.value})}>
            <option value="all">All</option>
            <option value="done">Done only</option>
            <option value="pending">Pending / Undone</option>
          </select>
        </div>
        <div><label className="label">From date</label><input type="date" className="input" value={filter.dateFrom} onChange={e=>setFilter({...filter, dateFrom:e.target.value})} /></div>
        <button className="btn btn-secondary" onClick={()=>setFilter({member:'', status:'all', dateFrom:''})}>Clear</button>
      </div>
    </div>

    <div className="card overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead><tr><th>Date</th><th>Task</th><th>Assigned To</th><th>Status</th><th>Marked By</th><th>Marked At</th></tr></thead>
        <tbody>
          {filtered.slice(0,300).map(c=>{
            const t = tasks[c.taskId]
            const swap = swapInfo(c.taskId, c.date)
            return <tr key={c.id}>
              <td>{c.date}</td>
              <td><b>{t?.title || c.taskId}</b></td>
              <td>{assigneeName(c.taskId, c.assigneeKey)}
                {swap && <div className="text-[11px] text-amber-700">{swap}</div>}
              </td>
              <td>{c.done ? <span className="pill bg-emerald-100 text-emerald-700">Done</span> : <span className="pill bg-orange-100 text-orange-800">Pending</span>}</td>
              <td className="text-sm">{doneByName(c.doneBy)}</td>
              <td className="text-sm text-slate-500">{c.doneAt ? new Date(c.doneAt).toLocaleString('en-GB', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '—'}</td>
            </tr>
          })}
          {filtered.length===0 && <tr><td colSpan={6} className="text-slate-500">No records. Mark some tasks done in Tasks page first.</td></tr>}
        </tbody>
      </table>
      {filtered.length > 300 && <div className="text-xs text-slate-500 mt-2">Showing first 300 of {filtered.length}</div>}
    </div>
  </AppShell>
}
