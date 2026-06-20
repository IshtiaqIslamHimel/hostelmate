'use client'
import AppShell from '@/components/AppShell'
import { useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { addDays, todayISO } from '@/lib/schedule'

export default function FoodPage(){
  const { profile } = useAuthProfile()
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
        userId: profile.uid,
        date,
        lunch: !!m.lunch,
        dinner: !!m.dinner,
        updatedAt: new Date().toISOString()
      })
      setMsg('Saved ' + date)
      setTimeout(()=>setMsg(''), 1500)
    } catch(e:any){ alert(e.message) }
    setSaving(null)
  }

  const saveAll = async () => {
    for (const d of dates) await save(d)
  }

  return <AppShell>
    <h1 className="text-2xl font-extrabold mb-1">Food / Meal</h1>
    <p className="text-slate-500 mb-4">Toggle your meals, then hit Save. Saved meals count toward Mess costing.</p>
    {msg && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">{msg}</div>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {dates.map(d=>{
        const m = meals[d] || {lunch:true, dinner:true}
        const dirty = true // simple – always allow save
        return <div key={d} className="card">
          <div className="font-bold mb-2">{d} {d===todayISO() && <span className="pill bg-indigo-100 text-indigo-700 ml-2">Today</span>}</div>
          <label className="flex items-center gap-3 py-2.5 text-[15px]"><input type="checkbox" className="w-5 h-5" checked={m.lunch} onChange={e=>toggle(d,'lunch', e.target.checked)} /> Lunch</label>
          <label className="flex items-center gap-3 py-2.5 text-[15px]"><input type="checkbox" className="w-5 h-5" checked={m.dinner} onChange={e=>toggle(d,'dinner', e.target.checked)} /> Dinner</label>
          <button disabled={saving===d} onClick={()=>save(d)} className="btn w-full mt-2 !py-2">{saving===d ? 'Saving…' : 'Save Meal'}</button>
        </div>
      })}
    </div>
    <div className="mt-3">
      <button onClick={saveAll} className="btn btn-secondary">Save All 5 Days</button>
      <span className="text-xs text-slate-500 ml-3">Meals are stored as <code>meals/{'{userId}_{date}'}</code> – Admin → Costs reads these for Meal Rate.</span>
    </div>
  </AppShell>
}
