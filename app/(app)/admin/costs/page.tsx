'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'

export default function AdminCosts(){
  const { profile } = useAuthProfile()
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7)) // YYYY-MM
  const [bazar, setBazar] = useState<any[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const load = async ()=>{
    const start = month + '-01'
    const end = month + '-31'
    const [b,u,m] = await Promise.all([
      getDocs(query(collection(db,'bazar'), where('date','>=',start), where('date','<=',end))),
      getDocs(collection(db,'users')),
      getDocs(query(collection(db,'meals'), where('date','>=',start), where('date','<=',end))),
    ])
    setBazar(b.docs.map(d=>({id:d.id, ...d.data()})))
    setUsers(u.docs.map(d=>({id:d.id, ...d.data() as any})).filter((x:any)=>x.role==='member'))
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

  const totalBazar = bazar.reduce((s,b)=> s + Number(b.amount||0), 0)
  const mealCounts: Record<string, number> = {}
  meals.forEach((m:any)=> {
    const c = (m.lunch?1:0)+(m.dinner?1:0)
    mealCounts[m.userId] = (mealCounts[m.userId]||0)+c
  })
  const totalMeals = Object.values(mealCounts).reduce((a,b)=>a+b,0)
  const mealRate = totalMeals ? totalBazar/totalMeals : 0

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-1">Food Costs / Mess</h1>
    <p className="text-slate-500 mb-4">Mobile-fast meal costing</p>

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

    <div className="grid md:grid-cols-2 gap-3">
      <div className="card">
        <h3 className="font-bold mb-2">Per Member Dues</h3>
        <table className="w-full text-sm">
          <thead><tr><th>Member</th><th>Meals</th><th>Due ৳</th></tr></thead>
          <tbody>
            {users.map(u=>{
              const c = mealCounts[u.id]||0
              return <tr key={u.id}><td>{u.name}</td><td>{c}</td><td className="font-semibold">৳{(c*mealRate).toFixed(0)}</td></tr>
            })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3 className="font-bold mb-2">Bazar Log – {month}</h3>
        <div className="text-sm space-y-1 max-h-72 overflow-auto">
          {bazar.sort((a,b)=>b.date.localeCompare(a.date)).map(b=> <div key={b.id} className="flex justify-between border-b border-slate-100 py-1"><span>{b.date} · {b.note||'—'}</span><b>৳{b.amount}</b></div>)}
          {bazar.length===0 && <div className="text-slate-500">No entries yet</div>}
        </div>
      </div>
    </div>
  </AppShell>
}
