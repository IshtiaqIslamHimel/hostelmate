'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { addDoc, collection, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { useEffect, useState } from 'react'

export default function AdminTasks(){
  const { profile } = useAuthProfile()
  const [tasks,setTasks] = useState<any[]>([])
  const [users,setUsers] = useState<any[]>([])
  const [rooms,setRooms] = useState<any[]>([])
  const [f,setF] = useState({title:'', description:'', assignType:'member', rotation:'round_robin', repeat:'weekly', intervalDays:7, startDate: new Date().toISOString().slice(0,10), targets: [] as string[] })

  const load = async ()=>{
    const [t,u,r] = await Promise.all([getDocs(collection(db,'tasks')), getDocs(collection(db,'users')), getDocs(collection(db,'rooms'))])
    setTasks(t.docs.map(d=>({id:d.id, ...d.data()})))
    // include admin accounts too – admin can be assigned to tasks like a member
    setUsers(u.docs.map(d=>({id:d.id, ...d.data() as any})).sort((a,b)=> (a.name||'').localeCompare(b.name||'')))
    setRooms(r.docs.map(d=>({id:d.id, ...d.data() as any})))
  }
  useEffect(()=>{ load() },[])
  if(profile?.role!=='admin') return <AppShell><div>Admin only</div></AppShell>

  const toggleTarget = (id:string)=>{
    setF(s=>({...s, targets: s.targets.includes(id) ? s.targets.filter(x=>x!==id) : [...s.targets, id]}))
  }
  const save = async ()=>{
    if(!f.title || f.targets.length===0) return alert('Title + at least 1 target')
    await addDoc(collection(db,'tasks'), {...f, intervalDays: Number(f.intervalDays)})
    setF({title:'', description:'', assignType:'member', rotation:'round_robin', repeat:'weekly', intervalDays:7, startDate: new Date().toISOString().slice(0,10), targets: []})
    load()
  }

  const targetList = f.assignType==='member' ? users : rooms

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-3">Manage Tasks</h1>
    <div className="card mb-4">
      <h3 className="font-bold mb-2">New Task</h3>
      <div className="grid md:grid-cols-2 gap-2">
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={e=>setF({...f, title:e.target.value})} /></div>
        <div><label className="label">Description</label><input className="input" value={f.description} onChange={e=>setF({...f, description:e.target.value})} /></div>
        <div><label className="label">Assign Type</label>
          <select className="input" value={f.assignType} onChange={e=>setF({...f, assignType:e.target.value as any, targets:[]})}>
            <option value="member">Member-wise (includes admin accounts)</option>
            <option value="room">Room-wise</option>
          </select>
        </div>
        <div><label className="label">Start Date</label><input type="date" className="input" value={f.startDate} onChange={e=>setF({...f, startDate:e.target.value})} /></div>
        <div><label className="label">Rotation</label>
          <select className="input" value={f.rotation} onChange={e=>setF({...f, rotation:e.target.value})}>
            <option value="round_robin">Round Robin</option>
            <option value="all">All together</option>
          </select>
        </div>
        <div><label className="label">Repeat</label>
          <select className="input" value={f.repeat} onChange={e=>setF({...f, repeat:e.target.value})}>
            <option value="once">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom gap days</option>
          </select>
        </div>
        {f.repeat==='custom' && <div><label className="label">Gap days</label><input type="number" className="input" value={f.intervalDays} onChange={e=>setF({...f, intervalDays: parseInt(e.target.value)||1})} /></div>}
      </div>
      <div className="mt-3">
        <div className="label">Select Targets {f.assignType==='room' ? '(e.g. pick 2 of 3 rooms)' : ''}</div>
        <div className="flex flex-wrap gap-2">
          {targetList.map((x:any)=> <label key={x.id} className={`px-3 py-1.5 rounded-full border cursor-pointer text-sm ${f.targets.includes(x.id) ? 'bg-indigo-50 border-indigo-300 text-brand' : 'bg-white border-slate-200'}`}>
            <input type="checkbox" className="mr-2" checked={f.targets.includes(x.id)} onChange={()=>toggleTarget(x.id)} />
            {x.name} {x.role==='admin' && <span className="text-[10px] text-brand">(admin)</span>}
          </label>)}
        </div>
      </div>
      <button className="btn mt-3" onClick={save}>Save Task</button>
    </div>

    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead><tr><th>Task</th><th>Assign</th><th>Rotation</th><th>Repeat</th><th></th></tr></thead>
        <tbody>
          {tasks.map((t:any)=> <tr key={t.id}>
            <td><b>{t.title}</b><div className="text-slate-500 text-xs">{t.description}</div></td>
            <td className="text-xs">{t.assignType}: {t.targets?.length || 0} targets</td>
            <td>{t.rotation}</td>
            <td>{t.repeat}{t.repeat==='custom' ? ` / ${t.intervalDays}d` : ''}</td>
            <td><button className="btn btn-red !py-1 !px-2 text-xs" onClick={async()=>{ await deleteDoc(doc(db,'tasks',t.id)); load()}}>Delete</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </AppShell>
}
