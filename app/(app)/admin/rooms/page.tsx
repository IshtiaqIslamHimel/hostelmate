'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

export default function AdminRooms(){
  const { profile } = useAuthProfile()
  const [rooms,setRooms] = useState<any[]>([])
  const [members,setMembers] = useState<any[]>([])
  const [name,setName] = useState('')
  const [cap,setCap] = useState(2)

  const load = async ()=>{
    const [r,m] = await Promise.all([getDocs(collection(db,'rooms')), getDocs(collection(db,'users'))])
    setRooms(r.docs.map(d=>({id:d.id, ...d.data()})))
    setMembers(m.docs.map(d=>({id:d.id, ...d.data()})).filter((u:any)=>u.role==='member'))
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
  return <AppShell>
    <div className="flex items-center justify-between mb-3">
      <h1 className="text-2xl font-extrabold">Rooms</h1>
    </div>
    <div className="card mb-4">
      <div className="flex gap-2">
        <input className="input max-w-xs" placeholder="Room 104" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input w-28" type="number" value={cap} onChange={e=>setCap(parseInt(e.target.value)||2)} />
        <button className="btn" onClick={addRoom}>+ New Room</button>
      </div>
    </div>
    <div className="grid md:grid-cols-3 gap-3">
      {rooms.map(r=>{
        const mems = members.filter((m:any)=>m.roomId===r.id)
        return <div key={r.id} className="card">
          <div className="flex justify-between font-bold">{r.name}<span className="text-slate-500 text-sm">{mems.length}/{r.capacity}</span></div>
          <div className="text-sm mt-2 space-y-1">
            {mems.map((m:any)=> <div key={m.id} className="flex justify-between">{m.name} <button className="text-red-600 text-xs" onClick={()=>assign(m.id, null)}>remove</button></div>)}
            {mems.length===0 && <div className="text-slate-500">Empty</div>}
          </div>
          <select className="input mt-2" defaultValue="" onChange={e=>{ if(e.target.value) { assign(e.target.value, r.id); e.target.value=''} }}>
            <option value="">Assign member…</option>
            {members.filter((m:any)=>!m.roomId).map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      })}
    </div>
  </AppShell>
}
