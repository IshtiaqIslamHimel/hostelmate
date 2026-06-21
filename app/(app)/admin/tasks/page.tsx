'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { getSchedulePreview, TaskDoc } from '@/lib/schedule'

type FTask = {
  title:string; description:string; assignType:'member'|'room';
  rotation:'round_robin'|'all';
  repeat:'once'|'daily'|'weekly'|'custom';
  intervalDays:number; startDate:string; targets:string[]
}

export default function AdminTasks(){
  const { profile } = useAuthProfile()
  const [tasks,setTasks] = useState<any[]>([])
  const [users,setUsers] = useState<any[]>([])
  const [rooms,setRooms] = useState<any[]>([])
  const [f,setF] = useState<FTask>({title:'', description:'', assignType:'member', rotation:'round_robin', repeat:'weekly', intervalDays:7, startDate: new Date().toISOString().slice(0,10), targets: []})
  const [detailTask, setDetailTask] = useState<any|null>(null)

  const load = async ()=>{
    const [t,u,r] = await Promise.all([
      getDocs(collection(db,'tasks')),
      getDocs(collection(db,'users')),
      getDocs(collection(db,'rooms'))
    ])
    setTasks(t.docs.map(d=>({id:d.id, ...d.data()})))
    setUsers(u.docs.map(d=>({id:d.id, ...d.data() as any})).sort((a,b)=> (a.name||'').localeCompare(b.name||'')))
    setRooms(r.docs.map(d=>({id:d.id, ...d.data() as any})))
  }
  useEffect(()=>{ load() },[])
  if(profile?.role!=='admin') return <AppShell><div>Admin only</div></AppShell>

  const targetList = f.assignType==='member' ? users : rooms
  const nameOf = (id:string, type:'member'|'room') => {
    if(type==='member') return users.find(u=>u.id===id)?.name || id
    return rooms.find(r=>r.id===id)?.name || id
  }

  const addTarget = (id:string) => {
    if(!f.targets.includes(id)) setF({...f, targets:[...f.targets, id]})
  }
  const removeTarget = (id:string) => {
    setF({...f, targets: f.targets.filter(x=>x!==id)})
  }
  const moveTarget = (idx:number, dir:-1|1) => {
    const arr = [...f.targets]
    const j = idx + dir
    if(j < 0 || j >= arr.length) return
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    setF({...f, targets: arr})
  }

  const save = async ()=>{
    if(!f.title || f.targets.length===0) return alert('Title + at least 1 target')
    await addDoc(collection(db,'tasks'), {...f, intervalDays: Number(f.intervalDays)})
    setF({title:'', description:'', assignType:'member', rotation:'round_robin', repeat:'weekly', intervalDays:7, startDate: new Date().toISOString().slice(0,10), targets: []})
    load()
  }

  const openDetail = async (taskId:string) => {
    const snap = await getDoc(doc(db,'tasks', taskId))
    if(snap.exists()) setDetailTask({id:snap.id, ...snap.data()})
  }

  // preview schedule for current form
  const preview = f.targets.length ? getSchedulePreview(f as TaskDoc, 28, f.startDate) : []

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-3">Manage Tasks</h1>
    
    <div className="card mb-4">
      <h3 className="font-bold mb-2">New Task</h3>
      <div className="grid md:grid-cols-2 gap-2">
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={e=>setF({...f, title:e.target.value})} placeholder="e.g. Trash Duty" /></div>
        <div><label className="label">Description</label><input className="input" value={f.description} onChange={e=>setF({...f, description:e.target.value})} placeholder="Optional details" /></div>
        <div><label className="label">Assign Type</label>
          <select className="input" value={f.assignType} onChange={e=>setF({...f, assignType:e.target.value as any, targets:[]})}>
            <option value="member">Member-wise (includes admin)</option>
            <option value="room">Room-wise</option>
          </select>
        </div>
        <div><label className="label">Start Date</label><input type="date" className="input" value={f.startDate} onChange={e=>setF({...f, startDate:e.target.value})} /></div>
        <div><label className="label">Rotation</label>
          <select className="input" value={f.rotation} onChange={e=>setF({...f, rotation:e.target.value as any})}>
            <option value="round_robin">Round Robin – 1 by 1 in order</option>
            <option value="all">All together</option>
          </select>
        </div>
        <div><label className="label">Repeat</label>
          <select className="input" value={f.repeat} onChange={e=>setF({...f, repeat:e.target.value as any})}>
            <option value="once">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (7 days)</option>
            <option value="custom">Custom gap days</option>
          </select>
        </div>
        {f.repeat==='custom' && <div><label className="label">Gap days</label><input type="number" className="input" value={f.intervalDays} min={1} onChange={e=>setF({...f, intervalDays: parseInt(e.target.value)||1})} /></div>}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div>
          <div className="label">Available {f.assignType==='member' ? 'Members' : 'Rooms'}</div>
          <div className="border border-slate-200 rounded-xl p-2 max-h-56 overflow-auto bg-slate-50">
            {targetList.filter((x:any)=>!f.targets.includes(x.id)).map((x:any)=>(
              <button key={x.id} type="button" onClick={()=>addTarget(x.id)} className="block w-full text-left px-2 py-1.5 hover:bg-white rounded-lg text-sm">
                + {x.name} {x.role==='admin' && <span className="text-[10px] text-brand">(admin)</span>}
              </button>
            ))}
            {targetList.filter((x:any)=>!f.targets.includes(x.id)).length===0 && <div className="text-slate-500 text-sm px-2 py-1">All added</div>}
          </div>
        </div>
        <div>
          <div className="label">Rotation Order – drag order with ↑↓ ({f.targets.length} selected)</div>
          <div className="border border-slate-200 rounded-xl p-2 max-h-56 overflow-auto bg-white">
            {f.targets.length===0 && <div className="text-slate-500 text-sm px-2 py-1">Click names on the left to add them in order. First = 1st duty.</div>}
            {f.targets.map((id, idx)=>(
              <div key={id} className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 last:border-0 text-sm">
                <span><b className="text-slate-400 mr-2">{idx+1}.</b> {nameOf(id, f.assignType)}</span>
                <div className="flex gap-1">
                  <button type="button" className="px-2 py-0.5 text-xs bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-30" disabled={idx===0} onClick={()=>moveTarget(idx,-1)}>↑</button>
                  <button type="button" className="px-2 py-0.5 text-xs bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-30" disabled={idx===f.targets.length-1} onClick={()=>moveTarget(idx,1)}>↓</button>
                  <button type="button" className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded" onClick={()=>removeTarget(id)}>×</button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Order = duty order. 1st → 2nd → 3rd → loop. Use ↑↓ to reorder.</p>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-xs font-bold text-slate-600 mb-1">Schedule Preview – next {preview.length} occurrences</div>
          <div className="text-xs text-slate-600 max-h-36 overflow-auto">
            {preview.slice(0,12).map((p,i)=>(
              <div key={p.date}>{p.date} → {p.assignees.map(a=> nameOf(a, f.assignType)).join(', ')}</div>
            ))}
            {preview.length > 12 && <div>… {preview.length-12} more</div>}
          </div>
        </div>
      )}

      <button className="btn mt-3" onClick={save}>Save Task</button>
    </div>

    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead><tr><th>Task</th><th>Assign</th><th>Rotation</th><th>Repeat</th><th></th></tr></thead>
        <tbody>
          {tasks.map((t:any)=> <tr key={t.id} className="hover:bg-slate-50">
            <td>
              <button onClick={()=>openDetail(t.id)} className="text-left">
                <b className="text-brand hover:underline">{t.title}</b>
                <div className="text-slate-500 text-xs">{t.description || '—'}</div>
              </button>
            </td>
            <td className="text-xs">{t.assignType}: {t.targets?.length || 0}</td>
            <td>{t.rotation}</td>
            <td>{t.repeat}{t.repeat==='custom' ? ` / ${t.intervalDays}d` : ''}</td>
            <td className="whitespace-nowrap">
              <button className="btn btn-secondary !py-1 !px-2 text-xs mr-2" onClick={()=>openDetail(t.id)}>Details</button>
              <button className="btn btn-red !py-1 !px-2 text-xs" onClick={async()=>{ if(confirm('Delete task?')){ await deleteDoc(doc(db,'tasks',t.id)); load()}}}>Delete</button>
            </td>
          </tr>)}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">Click a task name / Details button to see full rotation schedule, completions, and edit order.</p>
    </div>

    {detailTask && <TaskDetailModal task={detailTask} users={users} rooms={rooms} onClose={()=>{ setDetailTask(null); load()}} />}
  </AppShell>
}

function TaskDetailModal({task, users, rooms, onClose}:{task:any, users:any[], rooms:any[], onClose:()=>void}) {
  const [targets, setTargets] = useState<string[]>(task.targets || [])
  const [saving, setSaving] = useState(false)
  const [completions, setCompletions] = useState<any[]>([])
  const nameOf = (id:string) => {
    if(task.assignType==='member') return users.find(u=>u.id===id)?.name || id
    return rooms.find(r=>r.id===id)?.name || id
  }

  useEffect(()=>{
    import('firebase/firestore').then(async ({collection, query, where, getDocs})=>{
      const { db } = await import('@/lib/firebaseClient')
      const snap = await getDocs(query(collection(db,'completions'), where('taskId','==', task.id)))
      setCompletions(snap.docs.map(d=>d.data()).sort((a:any,b:any)=>(b.doneAt||'').localeCompare(a.doneAt||'')))
    })
  }, [task.id])

  const move = (idx:number, dir:-1|1) => {
    const arr = [...targets]
    const j = idx + dir
    if(j<0 || j>=arr.length) return
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    setTargets(arr)
  }
  const remove = (id:string) => setTargets(t=>t.filter(x=>x!==id))

  const saveOrder = async () => {
    setSaving(true)
    const { doc, updateDoc } = await import('firebase/firestore')
    const { db } = await import('@/lib/firebaseClient')
    await updateDoc(doc(db,'tasks', task.id), { targets })
    setSaving(false)
    alert('Order saved')
    onClose()
  }

  const preview = getSchedulePreview({...task, targets}, 20, task.startDate)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-start mb-2">
          <div><h3 className="font-extrabold text-lg">{task.title}</h3><div className="text-slate-500 text-sm">{task.description || '—'}</div></div>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>
        <div className="text-xs text-slate-600 mb-3">
          Type: {task.assignType} · Rotation: {task.rotation} · Repeat: {task.repeat}{task.repeat==='custom' ? ` / ${task.intervalDays}d` : ''} · Start: {task.startDate}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="font-bold text-sm mb-1">Rotation Order – click ↑↓ to reorder</div>
            <div className="border border-slate-200 rounded-xl max-h-64 overflow-auto">
              {targets.map((id, idx)=>(
                <div key={id} className="flex items-center justify-between px-3 py-2 border-b border-slate-100 last:border-0 text-sm">
                  <span><b className="text-slate-400 mr-2">{idx+1}.</b> {nameOf(id)}</span>
                  <div className="flex gap-1">
                    <button className="px-2 py-0.5 text-xs bg-slate-100 rounded disabled:opacity-30" disabled={idx===0} onClick={()=>move(idx,-1)}>↑</button>
                    <button className="px-2 py-0.5 text-xs bg-slate-100 rounded disabled:opacity-30" disabled={idx===targets.length-1} onClick={()=>move(idx,1)}>↓</button>
                    <button className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded" onClick={()=>remove(id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn mt-2 w-full" disabled={saving} onClick={saveOrder}>{saving ? 'Saving…' : 'Save New Order'}</button>
            <p className="text-xs text-slate-500 mt-1">Changing order affects future duties immediately. Past completions are kept.</p>
          </div>
          <div>
            <div className="font-bold text-sm mb-1">Upcoming Schedule</div>
            <div className="border border-slate-200 rounded-xl p-2 max-h-64 overflow-auto text-xs bg-slate-50">
              {preview.map(p=> <div key={p.date}>{p.date} → {p.assignees.map(a=>nameOf(a)).join(', ')}</div>)}
            </div>
            <div className="font-bold text-sm mt-3 mb-1">Recent Completions</div>
            <div className="border border-slate-200 rounded-xl p-2 max-h-40 overflow-auto text-xs bg-slate-50">
              {completions.slice(0,20).map((c:any,i)=>(
                <div key={i}>{c.date} · {nameOf(c.assigneeKey)} · {c.done ? '✓ Done' : '✗'} {c.doneBy ? ' by '+(users.find(u=>u.id===c.doneBy)?.name||c.doneBy) : ''}</div>
              ))}
              {completions.length===0 && <span className="text-slate-500">No completions yet</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
