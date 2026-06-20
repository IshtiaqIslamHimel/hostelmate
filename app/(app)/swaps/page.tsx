'use client'
import AppShell from '@/components/AppShell'
import { adminFetch, useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAssigneesForTaskOnDate, TaskDoc, todayISO, addDays } from '@/lib/schedule'

function SwapsInner(){
  const { profile } = useAuthProfile()
  const search = useSearchParams()
  const preTask = search.get('task') || ''
  const preDate = search.get('date') || ''
  
  const [swaps,setSwaps] = useState<any[]>([])
  const [members,setMembers] = useState<any[]>([])
  const [tasks,setTasks] = useState<TaskDoc[]>([])
  const [rooms,setRooms] = useState<Record<string,string>>({})
  const [form,setForm] = useState({taskId: preTask, date: preDate, fromUserId: '', toUserId: ''})
  const [loading,setLoading] = useState(false)

  const load = async ()=>{
    const [s, u, t, r] = await Promise.all([
      getDocs(collection(db,'swaps')),
      getDocs(collection(db,'users')), // include admin accounts – admin is a member too
      getDocs(collection(db,'tasks')),
      getDocs(collection(db,'rooms')),
    ])
    setSwaps(s.docs.map(d=>({id:d.id, ...d.data()})))
    const mems = u.docs.map(d=>({id:d.id, ...(d.data() as any)}))
      .sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    setMembers(mems)
    setTasks(t.docs.map(d=>({id:d.id, ...d.data()} as TaskDoc)))
    const rm:Record<string,string>={}; r.forEach(d=> rm[d.id] = (d.data() as any).name); setRooms(rm)
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{ setForm(f=>({...f, taskId: preTask || f.taskId, date: preDate || f.date})) }, [preTask, preDate])

  // Members can only swap their own tasks – lock fromUserId
  useEffect(()=>{
    if (profile && profile.role === 'member') {
      setForm(f=> ({...f, fromUserId: profile.uid}))
    }
  }, [profile?.uid, profile?.role])

  const createSwap = async ()=>{
    if(!profile) return
    const fromUserId = profile.role === 'admin' ? (form.fromUserId || profile.uid) : profile.uid
    if (!form.taskId || !form.date || !form.toUserId || !fromUserId) { alert('Select a task and a member to swap with'); return }
    if (fromUserId === form.toUserId) { alert('Cannot swap with yourself'); return }
    setLoading(true)
    try {
      await adminFetch('/api/swap/create', { taskId: form.taskId, date: form.date, fromUserId, toUserId: form.toUserId })
      alert('Swap request sent. The other member will be notified on Telegram if linked.')
      setForm({taskId:'', date:'', toUserId:'', fromUserId: profile.role==='member' ? profile.uid : ''})
      load()
    } catch(e:any){ alert(e.message) }
    finally { setLoading(false) }
  }

  const respond = async (id:string, accept:boolean)=>{
    try {
      await adminFetch('/api/swap/respond', { swapId: id, accept })
      load()
    } catch(e:any){ alert(e.message) }
  }

  const name = (uid:string)=> members.find(m=>m.id===uid)?.name || uid
  const taskName = (tid:string)=> tasks.find(t=>t.id===tid)?.title || tid
  if(!profile) return null

  const incoming = swaps.filter(s=>s.toUserId === profile.uid)
  const outgoing = swaps.filter(s=>s.fromUserId === profile.uid)
  const isAdmin = profile.role === 'admin'

  // Build "my assignable duties" list for member swap dropdown
  const mySwappable: {taskId:string, date:string, label:string}[] = []
  if (profile.role === 'member') {
    const dates = [...Array(14)].map((_,i)=> addDays(todayISO(), i-2))
    tasks.forEach(t=>{
      dates.forEach(date=>{
        const assignees = getAssigneesForTaskOnDate(t, date)
        const isMine = t.assignType==='member'
          ? assignees.includes(profile.uid)
          : assignees.includes(profile.roomId || '')
        if (isMine) {
          const assignLabel = t.assignType==='member' ? '' : ` · ${rooms[assignees[0]] || assignees[0]}`
          mySwappable.push({taskId: t.id, date, label: `${fmt(date)} · ${t.title}${assignLabel}`})
        }
      })
    })
  }

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-1">Task Swaps</h1>
    <p className="text-slate-500 mb-4">Audit trail – assignments never mutate. {isAdmin ? 'Admin can swap any task for anyone.' : 'You can only swap your own assigned tasks.'}</p>

    <div className="card mb-4">
      <h3 className="font-bold mb-3">Request Swap</h3>
      
      {isAdmin ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <div>
              <label className="label">From Member</label>
              <select className="input" value={form.fromUserId} onChange={e=>setForm({...form, fromUserId:e.target.value})}>
                <option value="">Select…</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Task</label>
              <select className="input" value={form.taskId} onChange={e=>setForm({...form, taskId:e.target.value})}>
                <option value="">Select…</option>
                {tasks.map(t=> <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
            </div>
            <div>
              <label className="label">Swap with</label>
              <select className="input" value={form.toUserId} onChange={e=>setForm({...form, toUserId:e.target.value})}>
                <option value="">Select…</option>
                {members.filter(m=>m.id!==form.fromUserId).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn mt-3" disabled={loading || !form.taskId || !form.date || !form.toUserId || !form.fromUserId} onClick={createSwap}>{loading ? 'Sending…' : 'Create Swap (Admin)'}</button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px_160px] gap-3 items-start">
            <div>
              <label className="label">My Task to Swap</label>
              <select className="input" value={form.taskId ? `${form.taskId}|${form.date}` : ''} onChange={e=>{
                const [taskId, date] = e.target.value.split('|')
                setForm({...form, taskId: taskId||'', date: date||''})
              }}>
                <option value="">Select your task…</option>
                {mySwappable.map(s=> <option key={s.taskId+'|'+s.date} value={s.taskId+'|'+s.date}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Swap with</label>
              <select className="input" value={form.toUserId} onChange={e=>setForm({...form, toUserId:e.target.value})}>
                <option value="">Select member…</option>
                {members.filter(m=>m.id!==profile.uid).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              {/* invisible label spacer – keeps button aligned with the selects */}
              <label className="label opacity-0 hidden md:block select-none" aria-hidden="true">.</label>
              <button className="btn w-full" disabled={loading || !form.taskId || !form.toUserId} onClick={createSwap}>
                {loading ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Only tasks assigned to you appear here. The other member gets a Telegram DM automatically if they linked their chat_id in Admin → Members.</p>
        </>
      )}
    </div>

    <div className="grid md:grid-cols-2 gap-3">
      <div className="card">
        <h3 className="font-bold mb-2">Incoming Requests</h3>
        {incoming.length===0 && <div className="text-slate-500 text-sm">None</div>}
        {incoming.map(s=> <div key={s.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 gap-3">
          <div><b>{taskName(s.taskId)}</b> · {s.date}<br/><span className="text-slate-500 text-sm">From {name(s.fromUserId)}</span> · <span className="pill bg-slate-100">{s.status}</span></div>
          {s.status==='pending' && <div className="flex gap-2 shrink-0"><button className="btn btn-green !py-1.5 !px-3 text-xs" onClick={()=>respond(s.id,true)}>Accept</button><button className="btn btn-secondary !py-1.5 !px-3 text-xs" onClick={()=>respond(s.id,false)}>Reject</button></div>}
        </div>)}
      </div>
      <div className="card">
        <h3 className="font-bold mb-2">My Outgoing</h3>
        {outgoing.length===0 && <div className="text-slate-500 text-sm">None</div>}
        {outgoing.map(s=> <div key={s.id} className="py-2 border-b border-slate-100 last:border-0 text-sm">
          <b>{taskName(s.taskId)}</b> · {s.date} → {name(s.toUserId)} · <span className="pill bg-slate-100">{s.status}</span>
        </div>)}
      </div>
    </div>

    {isAdmin && (
      <div className="card mt-3">
        <h3 className="font-bold mb-2">All Swaps – Audit Log</h3>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th>Date</th><th>Task</th><th>From</th><th>To</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {swaps.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')).map(s=>(
              <tr key={s.id}>
                <td>{s.date}</td>
                <td>{taskName(s.taskId)}</td>
                <td>{name(s.fromUserId)}</td>
                <td>{name(s.toUserId)}</td>
                <td>{s.status}</td>
                <td className="text-slate-500 text-xs">{s.createdAt ? new Date(s.createdAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
              </tr>
            ))}
            {swaps.length===0 && <tr><td colSpan={6} className="text-slate-500">No swaps yet</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    )}
  </AppShell>
}

function fmt(d:string){ const x=new Date(d+'T12:00:00'); return x.toLocaleDateString('en-GB',{day:'2-digit', month:'short'})}

export default function SwapsPage(){
  return <Suspense><SwapsInner/></Suspense>
}
