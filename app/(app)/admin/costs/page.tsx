'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { addDoc, collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'

export default function AdminCosts(){
  const { profile } = useAuthProfile()
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7)) // YYYY-MM
  const [bazar, setBazar] = useState<any[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [mealEdit, setMealEdit] = useState<{userId:string, date:string, lunch:boolean, dinner:boolean} | null>(null)

  const load = async ()=>{
    const start = month + '-01'
    const end = month + '-31'
    const [b,u,m] = await Promise.all([
      getDocs(query(collection(db,'bazar'), where('date','>=',start), where('date','<=',end))),
      getDocs(collection(db,'users')),
      getDocs(query(collection(db,'meals'), where('date','>=',start), where('date','<=',end))),
    ])
    setBazar(b.docs.map(d=>({id:d.id, ...d.data()})))
    setUsers(u.docs.map(d=>({id:d.id, ...d.data() as any})).filter((x:any)=>x.role==='member' || x.role==='admin').sort((a:any,b:any)=>a.name.localeCompare(b.name)))
    setMeals(m.docs.map(d=>d.data() as any))
  }
  useEffect(()=>{ load() }, [month])
  if(profile?.role!=='admin') return <AppShell><div>Admin only</div></AppShell>

  const addBazar = async ()=>{
    const amt = parseFloat(amount)
    if(!amt) return
    await addDoc(collection(db,'bazar'), { date: new Date().toISOString().slice(0,10), amount: amt, note, addedBy: profile.uid, createdAt: new Date().toISOString() })
    setAmount(''); setNote(''); load()
  }
  const deleteBazar = async (id:string) => {
    if(!confirm('Delete this bazar entry?')) return
    await deleteDoc(doc(db,'bazar', id))
    load()
  }

  const mealCounts: Record<string, number> = {}
  meals.forEach((m:any)=> {
    const c = (m.lunch?1:0)+(m.dinner?1:0)
    mealCounts[m.userId] = (mealCounts[m.userId]||0)+c
  })
  const totalBazar = bazar.reduce((s,b)=> s + Number(b.amount||0), 0)
  const totalMeals = Object.values(mealCounts).reduce((a,b)=>a+b,0)
  const mealRate = totalMeals ? totalBazar/totalMeals : 0

  const saveMealEdit = async () => {
    if(!mealEdit) return
    await setDoc(doc(db,'meals', `${mealEdit.userId}_${mealEdit.date}`), {
      userId: mealEdit.userId,
      date: mealEdit.date,
      lunch: mealEdit.lunch,
      dinner: mealEdit.dinner,
      updatedAt: new Date().toISOString(),
      updatedBy: profile.uid,
    })
    setMealEdit(null)
    load()
  }
  const deleteMeal = async (userId:string, date:string) => {
    if(!confirm(`Delete meal entry for ${date}?`)) return
    await deleteDoc(doc(db,'meals', `${userId}_${date}`))
    load()
  }

  // Build meal grid for quick correction
  const daysInMonth = (() => {
    const [y,m] = month.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  })()
  const monthDays = Array.from({length: daysInMonth}, (_,i)=> `${month}-${String(i+1).padStart(2,'0')}`)

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-1">Food Costs / Mess</h1>
    <p className="text-slate-500 mb-4">Bazar entry, meal count correction, auto meal rate</p>

    <div className="card mb-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div><label className="label">Month</label><input type="month" className="input" value={month} onChange={e=>setMonth(e.target.value)} /></div>
        <div><label className="label">Bazar Amount ৳</label><input className="input w-36" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="500" /></div>
        <div className="flex-1 min-w-[160px]"><label className="label">Note</label><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Chicken, rice…" /></div>
        <button className="btn" onClick={addBazar}>Add Bazar</button>
      </div>
    </div>

    <div className="grid sm:grid-cols-3 gap-3 mb-3">
      <div className="card"><div className="text-2xl font-extrabold">৳{totalBazar.toFixed(0)}</div><div className="text-slate-500 text-sm">Total Bazar ({month})</div></div>
      <div className="card"><div className="text-2xl font-extrabold">{totalMeals}</div><div className="text-slate-500 text-sm">Total Meals</div></div>
      <div className="card"><div className="text-2xl font-extrabold">৳{mealRate.toFixed(2)}</div><div className="text-slate-500 text-sm">Meal Rate</div></div>
    </div>

    <div className="grid lg:grid-cols-2 gap-3">
      <div className="card">
        <h3 className="font-bold mb-2">Per Member Dues</h3>
        <table className="w-full text-sm">
          <thead><tr><th>Member</th><th>Meals</th><th>Due ৳</th></tr></thead>
          <tbody>
            {users.map(u=>{
              const c = mealCounts[u.id]||0
              return <tr key={u.id}><td>{u.name} {u.role==='admin' && <span className="text-[10px] text-brand">(admin)</span>}</td><td>{c}</td><td className="font-semibold">৳{(c*mealRate).toFixed(0)}</td></tr>
            })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">Bazar Log – {month}</h3>
        </div>
        <div className="text-sm space-y-1 max-h-72 overflow-auto">
          {bazar.sort((a,b)=>b.date.localeCompare(a.date)).map(b=> 
            <div key={b.id} className="flex justify-between border-b border-slate-100 py-1 gap-2">
              <span>{b.date} · {b.note||'—'}</span>
              <span className="flex items-center gap-3"><b>৳{b.amount}</b>
                <button onClick={()=>deleteBazar(b.id)} className="text-red-600 text-xs hover:underline">Delete</button>
              </span>
            </div>)}
          {bazar.length===0 && <div className="text-slate-500">No entries yet</div>}
        </div>
      </div>
    </div>

    {/* Meal correction grid */}
    <div className="card mt-3 overflow-x-auto">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Meal Correction – {month}</h3>
        <span className="text-xs text-slate-500">Click a cell to edit / delete. Green = ON, gray = OFF</span>
      </div>
      <div className="overflow-auto max-h-[480px]">
        <table className="text-xs border-collapse">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th className="sticky left-0 bg-white px-2 py-1 text-left border-b">Member</th>
              {monthDays.map(d=> <th key={d} className="px-1 py-1 border-b font-normal text-slate-500">{d.slice(8)}</th>)}
              <th className="px-2 py-1 border-b">Total</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u=>{
              const total = mealCounts[u.id]||0
              return <tr key={u.id} className="hover:bg-slate-50">
                <td className="sticky left-0 bg-white px-2 py-1 whitespace-nowrap border-b border-slate-100">{u.name}</td>
                {monthDays.map(date=>{
                  const m = meals.find(x=>x.userId===u.id && x.date===date)
                  const lunch = m?.lunch ?? false
                  const dinner = m?.dinner ?? false
                  const count = (lunch?1:0)+(dinner?1:0)
                  return <td key={date} className="px-0.5 py-0.5 border-b border-slate-100 text-center">
                    <button
                      onClick={()=> setMealEdit({userId: u.id, date, lunch, dinner})}
                      className={`w-7 h-7 rounded text-[10px] font-bold ${count===2 ? 'bg-emerald-500 text-white' : count===1 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500'}`}
                      title={`${date} – L:${lunch?'on':'off'} D:${dinner?'on':'off'} – click to edit`}
                    >{count}</button>
                  </td>
                })}
                <td className="px-2 font-bold">{total}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-2">0=off, 1=lunch or dinner, 2=both. Click any cell to edit or delete. Members submit via Food page → Save Meal button.</p>
    </div>

    {mealEdit && (
      <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={()=>setMealEdit(null)}>
        <div className="card w-full max-w-sm" onClick={e=>e.stopPropagation()}>
          <h3 className="font-bold mb-2">Edit Meal</h3>
          <div className="text-sm text-slate-600 mb-3">
            {users.find(u=>u.id===mealEdit.userId)?.name} · {mealEdit.date}
          </div>
          <label className="flex items-center gap-2 py-2"><input type="checkbox" checked={mealEdit.lunch} onChange={e=>setMealEdit({...mealEdit, lunch: e.target.checked})} /> Lunch</label>
          <label className="flex items-center gap-2 py-2"><input type="checkbox" checked={mealEdit.dinner} onChange={e=>setMealEdit({...mealEdit, dinner: e.target.checked})} /> Dinner</label>
          <div className="flex gap-2 mt-3">
            <button className="btn" onClick={saveMealEdit}>Save</button>
            <button className="btn btn-red" onClick={()=>{ deleteMeal(mealEdit.userId, mealEdit.date); setMealEdit(null)}}>Delete Entry</button>
            <button className="btn btn-secondary" onClick={()=>setMealEdit(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )}
  </AppShell>
}
