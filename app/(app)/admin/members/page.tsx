'use client'
import AppShell from '@/components/AppShell'
import { adminFetch, useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { collection, getDocs } from 'firebase/firestore'
import { useEffect, useState } from 'react'

type U = {id:string; name:string; email:string; role:'admin'|'member'; roomId:string|null; telegram_chat_id?:string|null; disabled?:boolean}

export default function AdminMembers(){
  const { profile } = useAuthProfile()
  const [users,setUsers] = useState<U[]>([])
  const [rooms,setRooms] = useState<any[]>([])
  const [form,setForm] = useState({name:'', email:'', password:'', role:'member' as 'admin'|'member', roomId: '', telegram_chat_id: ''})
  const [msg,setMsg]=useState('')
  const [edit,setEdit] = useState<U | null>(null)

  const load = async ()=>{
    const [u,r] = await Promise.all([getDocs(collection(db,'users')), getDocs(collection(db,'rooms'))])
    setUsers(u.docs.map(d=>({id:d.id, ...d.data()}) as U).sort((a,b)=> a.name.localeCompare(b.name)))
    setRooms(r.docs.map(d=>({id:d.id, ...d.data() as any})))
  }
  useEffect(()=>{ load() },[])
  if(profile?.role!=='admin') return <AppShell><div>Admin only</div></AppShell>

  const create = async ()=>{
    setMsg('')
    try {
      const j = await adminFetch('/api/admin/create-user', {...form})
      setMsg('Account created: '+j.uid)
      setForm({name:'', email:'', password:'', role:'member', roomId:'', telegram_chat_id:''})
      load()
    } catch(e:any){ setMsg(e.message) }
  }

  const saveEdit = async ()=>{
    if(!edit) return
    try {
      await adminFetch('/api/admin/update-user', {
        uid: edit.id,
        name: edit.name,
        email: edit.email,
        roomId: edit.roomId,
        telegram_chat_id: edit.telegram_chat_id || null,
        disabled: !!edit.disabled,
        role: edit.role,
      })
      setEdit(null); load(); alert('Saved')
    } catch(e:any){ alert(e.message) }
  }

  const resetPass = async (uid:string)=>{
    const np = prompt('New password (min 6 chars):')
    if(!np || np.length < 6) return
    try {
      await adminFetch('/api/admin/reset-password', { uid, newPassword: np })
      alert('Password changed')
    } catch(e:any){ alert(e.message) }
  }

  const deleteUser = async (uid:string, name:string)=>{
    if(uid === profile?.uid) return alert('You cannot delete your own account.')
    if(!confirm(`Delete ${name}? This removes their Auth account AND Firestore profile. Completions / swaps / board posts are kept for audit.`)) return
    try {
      await adminFetch('/api/admin/delete-user', { uid })
      load(); alert('Deleted')
    } catch(e:any){ alert(e.message) }
  }

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-3">Members & Admins</h1>
    
    <div className="card mb-4">
      <h3 className="font-bold mb-2">Create Account</h3>
      <p className="text-xs text-slate-500 mb-2">Admin creates all accounts via Firebase Auth. Users cannot self-register. Password ≥6 chars.</p>
      <div className="grid md:grid-cols-3 gap-2">
        <input className="input" placeholder="Full name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <input className="input" placeholder="email@hostel.local" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
        <input className="input" placeholder="password (min 6)" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
        <select className="input" value={form.role} onChange={e=>setForm({...form, role:e.target.value as any})}>
          <option value="member">Role: Member</option>
          <option value="admin">Role: Admin</option>
        </select>
        <select className="input" value={form.roomId} onChange={e=>setForm({...form, roomId:e.target.value})}>
          <option value="">Room (optional)</option>
          {rooms.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input className="input" placeholder="Telegram chat_id (optional)" value={form.telegram_chat_id} onChange={e=>setForm({...form, telegram_chat_id:e.target.value})} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button className="btn" onClick={create}>Create Account</button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>

    <div className="card overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Room</th><th>Telegram</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map((u)=>(
            <tr key={u.id} className={u.disabled ? 'opacity-60':''}>
              <td>{u.name} {u.id===profile?.uid && <span className="text-xs text-slate-400">(you)</span>}</td>
              <td>{u.email}</td>
              <td><span className={`pill ${u.role==='admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>{u.role}</span></td>
              <td>{rooms.find(r=>r.id===u.roomId)?.name || '—'}</td>
              <td className="text-xs text-slate-500">{u.telegram_chat_id || '—'}</td>
              <td>{u.disabled ? <span className="pill bg-slate-200 text-slate-600">Disabled</span> : <span className="pill bg-emerald-100 text-emerald-700">Active</span>}</td>
              <td className="whitespace-nowrap space-x-2">
                <button className="btn btn-secondary !py-1 !px-2 text-xs" onClick={()=>setEdit({...u})}>Edit</button>
                <button className="btn btn-secondary !py-1 !px-2 text-xs" onClick={()=>resetPass(u.id)}>Reset PW</button>
                <button className="btn btn-red !py-1 !px-2 text-xs disabled:opacity-40" disabled={u.id===profile?.uid} onClick={()=>deleteUser(u.id, u.name)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-3">Admins appear in task assignment, swaps, and board just like members. You cannot delete your own account.</p>
    </div>

    {edit && (
      <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={()=>setEdit(null)}>
        <div className="card w-full max-w-lg" onClick={e=>e.stopPropagation()}>
          <h3 className="font-bold text-lg mb-3">Edit {edit.name}</h3>
          <div className="grid gap-2">
            <div><label className="label">Name</label><input className="input" value={edit.name} onChange={e=>setEdit({...edit, name:e.target.value})}/></div>
            <div><label className="label">Email</label><input className="input" value={edit.email} onChange={e=>setEdit({...edit, email:e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Role</label>
                <select className="input" value={edit.role} onChange={e=>setEdit({...edit, role: e.target.value as any})} disabled={edit.id===profile?.uid}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                {edit.id===profile?.uid && <div className="text-xs text-slate-500 mt-1">Can't change your own role.</div>}
              </div>
              <div><label className="label">Room</label>
                <select className="input" value={edit.roomId||''} onChange={e=>setEdit({...edit, roomId: e.target.value || null})}>
                  <option value="">— None —</option>
                  {rooms.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="label">Telegram chat_id</label><input className="input" value={edit.telegram_chat_id||''} onChange={e=>setEdit({...edit, telegram_chat_id:e.target.value})}/></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!edit.disabled} onChange={e=>setEdit({...edit, disabled: e.target.checked})} disabled={edit.id===profile?.uid} /> Disable login</label>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn" onClick={saveEdit}>Save</button>
            <button className="btn btn-secondary" onClick={()=>setEdit(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )}
  </AppShell>
}
