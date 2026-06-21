'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { addDays, todayISO } from '@/lib/schedule'

export default function FoodPage(){
  const { profile } = useAuthProfile()
  const [tab, setTab] = useState<'meals'|'cost'>('meals')

  // --- meal entry ---
  const dates = [todayISO(), addDays(todayISO(),1), addDays(todayISO(),2), addDays(todayISO(),3), addDays(todayISO(),4)]
  const [meals, setMeals] = useState<Record<string,{lunch:boolean,dinner:boolean}>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(()=>{
    if(!profile) return
    ;(async ()=>{
      const m:Record<string,{lunch:boolean,dinner:boolean}> = {}
      for(const d of dates){
        const snap = await getDoc(doc(db,'meals', `${profile.uid}_${d}`))
        m[d] = snap.exists() ? snap.data() as any : {lunch:true, dinner:true}
      }
      setMeals(m)
    })()
  },[profile?.uid])

  const toggle = (date:string, key:'lunch'|'dinner', val:boolean) => {
    setMeals(s=>({...s, [date]: {...(s[date]||{lunch:true,dinner:true}), [key]: val}}))
  }

  const save = async (date:string) => {
    if(!profile) return
    const m = meals[date] || {lunch:true, dinner:true}
    setSaving(date); setMsg('')
    try {
      await setDoc(doc(db,'meals', `${profile.uid}_${date}`), {
        userId: profile.uid, date,
        lunch: !!m.lunch, dinner: !!m.dinner,
        updatedAt: new Date().toISOString()
      })
      setMsg('Saved ' + date)
      setTimeout(()=>setMsg(''), 1500)
    } catch(e:any){ alert(e.message) }
    setSaving(null)
  }

  const saveAll = async () => { for (const d of dates) await save(d) }

  return <AppShell>
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div>
        <h1 className="text-2xl font-extrabold">Food / Mess</h1>
        <p className="text-slate-500 text-sm">Meal entry and your mess cost – read only cost view</p>
      </div>
      <div className="flex bg-slate-100 p-1 rounded-xl text-sm font-semibold">
        <button onClick={()=>setTab('meals')} className={`px-4 py-1.5 rounded-lg ${tab==='meals' ? 'bg-white shadow-sm text-brand' : 'text-slate-600'}`}>Meal Entry</button>
        <button onClick={()=>setTab('cost')} className={`px-4 py-1.5 rounded-lg ${tab==='cost' ? 'bg-white shadow-sm text-brand' : 'text-slate-600'}`}>My Cost</button>
      </div>
    </div>

    {tab==='meals' ? (
      <>
        {msg && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">{msg}</div>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dates.map(d=>{
            const m = meals[d] || {lunch:true, dinner:true}
            return <div key={d} className="card">
              <div className="font-bold mb-2">{d} {d===todayISO() && <span className="pill bg-indigo-100 text-indigo-700 ml-2">Today</span>}</div>
              <label className="flex items-center gap-3 py-2.5 text-[15px]"><input type="checkbox" className="w-5 h-5" checked={m.lunch} onChange={e=>toggle(d,'lunch', e.target.checked)} /> Lunch</label>
              <label className="flex items-center gap-3 py-2.5 text-[15px]"><input type="checkbox" className="w-5 h-5" checked={m.dinner} onChange={e=>toggle(d,'dinner', e.target.checked)} /> Dinner</label>
              <button disabled={saving===d} onClick={()=>save(d)} className="btn w-full mt-2 !py-2">{saving===d ? 'Saving…' : 'Save Meal'}</button>
            </div>
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button onClick={saveAll} className="btn btn-secondary">Save All 5 Days</button>
          <span className="text-xs text-slate-500">Meals count toward your mess bill. Admin can correct mistakes in Admin → Costs.</span>
        </div>
      </>
    ) : (
      <CostView uid={profile?.uid || ''} />
    )}
  </AppShell>
}

function CostView({uid}:{uid:string}){
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [meals, setMeals] = useState<any[]>([])
  const [bazar, setBazar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = async (m:string) => {
    if(!uid) return
    setLoading(true); setErr('')
    try {
      const start = m + '-01', end = m + '-31'
      // Query by date only – no composite index needed, filter my meals client-side
      const [bSnap, mealsSnap] = await Promise.all([
        getDocs(query(collection(db,'bazar'), where('date','>=',start), where('date','<=',end))),
        getDocs(query(collection(db,'meals'), where('date','>=',start), where('date','<=',end))),
      ])
      const allMeals = mealsSnap.docs.map(d=>d.data() as any)
      setMeals(allMeals)
      setBazar(bSnap.docs.map(d=>d.data() as any))
    } catch(e:any){
      setErr(e.message || 'Failed to load')
      console.error(e)
    }
    setLoading(false)
  }
  useEffect(()=>{ load(month) }, [uid, month])

  const myMeals = meals.filter(m=>m.userId === uid)
  const totalBazar = bazar.reduce((s,b)=> s + Number(b.amount||0), 0)
  const totalAllMeals = meals.reduce((s,m)=> s + (m.lunch?1:0) + (m.dinner?1:0), 0)
  const myMealCount = myMeals.reduce((s,m)=> s + (m.lunch?1:0) + (m.dinner?1:0), 0)
  const mealRate = totalAllMeals ? totalBazar / totalAllMeals : 0
  const myDue = myMealCount * mealRate

  return (
    <div>
      <div className="card mb-3 flex flex-wrap items-end gap-3">
        <div><label className="label">Month</label><input type="month" className="input" value={month} onChange={e=>setMonth(e.target.value)} /></div>
        <button className="btn btn-secondary" onClick={()=>load(month)} disabled={loading}>{loading?'Loading…':'Refresh'}</button>
        <div className="text-xs text-slate-500">Read-only. Meal ON/OFF is in the Meal Entry tab. Bazar is managed by admin.</div>
      </div>

      {err && <div className="card mb-3 !border-red-200 !bg-red-50 text-red-700 text-sm">Failed to load costs: {err}</div>}

      <div className="grid sm:grid-cols-4 gap-3 mb-3">
        <div className="card"><div className="text-2xl font-extrabold">{myMealCount}</div><div className="text-slate-500 text-sm">My Meals</div></div>
        <div className="card"><div className="text-2xl font-extrabold">৳{mealRate.toFixed(2)}</div><div className="text-slate-500 text-sm">Meal Rate</div></div>
        <div className="card"><div className="text-2xl font-extrabold">৳{myDue.toFixed(0)}</div><div className="text-slate-500 text-sm">My Due</div></div>
        <div className="card"><div className="text-2xl font-extrabold">৳{totalBazar.toFixed(0)}</div><div className="text-slate-500 text-sm">Total Bazar</div></div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <h3 className="font-bold mb-2">My Meal Log – {month}</h3>
          <div className="text-sm max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead><tr><th>Date</th><th>Lunch</th><th>Dinner</th><th>Count</th></tr></thead>
              <tbody>
                {myMeals.sort((a,b)=>a.date.localeCompare(b.date)).map((m:any)=>(
                  <tr key={m.date}>
                    <td>{m.date}</td>
                    <td>{m.lunch ? <span className="pill bg-emerald-100 text-emerald-700">ON</span> : <span className="pill bg-slate-200 text-slate-600">OFF</span>}</td>
                    <td>{m.dinner ? <span className="pill bg-emerald-100 text-emerald-700">ON</span> : <span className="pill bg-slate-200 text-slate-600">OFF</span>}</td>
                    <td>{(m.lunch?1:0)+(m.dinner?1:0)}</td>
                  </tr>
                ))}
                {myMeals.length===0 && <tr><td colSpan={4} className="text-slate-500">{loading?'Loading…':'No meals recorded for this month. Go to Meal Entry tab and hit Save.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3 className="font-bold mb-2">Bazar Expenses – {month}</h3>
          <div className="text-sm space-y-1 max-h-80 overflow-auto">
            {bazar.sort((a,b)=>b.date.localeCompare(a.date)).map((b:any,i)=>
              <div key={i} className="flex justify-between border-b border-slate-100 py-1.5">
                <span>{b.date} · {b.note || '—'}</span>
                <b>৳{b.amount}</b>
              </div>
            )}
            {bazar.length===0 && <div className="text-slate-500">{loading?'Loading…':'No bazar expenses yet.'}</div>}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 text-sm">
            <div className="flex justify-between"><span>Total Bazar</span><b>৳{totalBazar.toFixed(0)}</b></div>
            <div className="flex justify-between"><span>Total Mess Meals</span><b>{totalAllMeals}</b></div>
            <div className="flex justify-between"><span>Meal Rate</span><b>৳{mealRate.toFixed(2)}</b></div>
            <div className="flex justify-between text-[15px] mt-2 pt-2 border-t"><span className="font-bold">My Due ({myMealCount} meals)</span><span className="font-extrabold text-brand">৳{myDue.toFixed(0)}</span></div>
          </div>
          <p className="text-xs text-slate-500 mt-3">Meal Rate = Total Bazar ÷ Total Mess Meals<br/>Your Due = Your Meals × Meal Rate<br/>Read-only – contact admin if a meal count looks wrong.</p>
        </div>
      </div>
    </div>
  )
}
