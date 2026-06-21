'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { addDoc, collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

type User = { id:string; name:string; email:string; role:'admin'|'member'; roomId:string|null }

export default function AdminRooms(){
  const { profile } = useAuthProfile()
  const [rooms,setRooms] = useState<any[]>([])
  const [users,setUsers] = useState<User[]>([])
  const [name,setName] = useState('')
  const [cap,setCap] = useState(2)

  const load = async ()=>{
    const [r,u] = await Promise.all([getDocs(collection(db,'rooms')), getDocs(collection(db,'users'))])
    setRooms(r.docs.map(d=>({id:d.id, ...d.data()})))
    setUsers(u.docs.map(d=>({id:d.id, ...d.data()}) as User).sort((a,b)=>a.name.localeCompare(b.name)))
  }
  useEffect(()=>{ load() },[])
  if(profile?.role!=='admin') return <AppShell><div>Admin only</div></AppShell>

  const addRoom = async ()=>{
    if(!name) return
    await addDoc(collection(db,'rooms'), {name, capacity: Number(cap)})
    setName(''); setCap(2); load()
  }
  const assign = async (uid:string, roomId:string|null)=>{
    await updateDoc(doc(db,'users',uid), {roomId})
    load()
  }

  const occupants = (roomId:string) => users.filter(u=>u.roomId===roomId)
  const unassigned = users.filter(u=>!u.roomId)

  return <AppShell>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h1 className="text-2xl font-extrabold">Rooms</h1>
        <p className="text-slate-500 text-sm">Admins and members can both be assigned to rooms.</p>
      </div>
    </div>
    <div className="card mb-4">
      <div className="flex gap-2 flex-wrap">
        <input className="input max-w-xs" placeholder="Room 104" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input w-28" type="number" value={cap} onChange={e=>setCap(parseInt(e.target.value)||2)} />
        <button className="btn" onClick={addRoom}>+ New Room</button>
      </div>
    </div>
    <div className="grid md:grid-cols-3 gap-3">
      {rooms.map(r=>{
        const mems = occupants(r.id)
        return <div key={r.id} className="card">
          <div className="flex justify-between font-bold">{r.name}<span className="text-slate-500 text-sm">{mems.length}/{r.capacity}</span></div>
          <div className="text-sm mt-2 space-y-1 min-h-[40px]">
            {mems.map((m)=> <div key={m.id} className="flex justify-between">
              <span>{m.name} {m.role==='admin' && <span className="text-[10px] text-brand">(admin)</span>}</span>
              <button className="text-red-600 text-xs" onClick={()=>assign(m.id, null)}>remove</button>
            </div>)}
            {mems.length===0 && <div className="text-slate-500">Empty</div>}
          </div>
          <select className="input mt-2 text-sm" defaultValue="" onChange={e=>{ if(e.target.value) { assign(e.target.value, r.id); e.target.selectedIndex=0} }}>
            <option value="">Assign person…</option>
            {unassigned.map((m:any)=><option key={m.id} value={m.id}>{m.name} {m.role==='admin' ? '(admin)' : ''}</option>)}
          </select>
        </div>
      })}
    </div>
    {unassigned.length > 0 && (
      <div className="card mt-3">
        <h3 className="font-bold mb-2">Unassigned ({unassigned.length})</h3>
        <div className="text-sm text-slate-600 flex flex-wrap gap-2">
          {unassigned.map(u=> <span key={u.id} className="pill bg-slate-100">{u.name} {u.role==='admin' && '(admin)'}</span>)}
        </div>
      </div>
    )}
  </AppShell>
}