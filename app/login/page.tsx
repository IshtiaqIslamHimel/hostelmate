'use client'
import { useState, Suspense } from 'react'
import { requestPasswordReset, signIn, useAuthProfile } from '@/lib/auth'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginInner(){
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [err,setErr] = useState('')
  const [info,setInfo] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const { profile, loading } = useAuthProfile()

  if (!loading && profile) { router.replace(redirectTo); return null }

  const submit = async (e:React.FormEvent) => {
    e.preventDefault()
    setErr(''); setInfo('')
    try { 
      await signIn(email, password)
      router.replace(redirectTo)
    }
    catch(e:any){ setErr(e.message || 'Login failed') }
  }
  const forgot = async () => {
    setErr(''); setInfo('')
    if (!email) { setErr('Enter your email first'); return }
    try { await requestPasswordReset(email); setInfo('Password reset email sent. Check your inbox.') }
    catch(e:any){ setErr(e.message) }
  }

  return <div className="min-h-screen grid place-items-center p-4">
    <form onSubmit={submit} className="card w-full max-w-sm">
      <div className="flex items-center gap-2 font-extrabold text-brand text-xl mb-2"><span className="w-9 h-9 bg-brand rounded-lg text-white grid place-items-center">HM</span> HostelMate</div>
      <h1 className="text-xl font-bold">Sign in</h1>
      <p className="text-sm text-slate-500 mb-4">Use the email and password provided by your hostel admin.</p>
      <label className="label">Email</label>
      <input className="input mb-3" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@hostel.local" />
      <label className="label">Password</label>
      <input className="input mb-2" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••" />
      <button type="button" onClick={forgot} className="text-xs text-brand hover:underline mb-3">Forgot password?</button>
      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      {info && <div className="text-emerald-700 text-sm mb-2">{info}</div>}
      <button className="btn w-full">Sign in</button>
      <p className="text-xs text-slate-400 mt-4 text-center">Hostel members: contact admin for account access.</p>
    </form>
  </div>
}

export default function LoginPage(){
  return <Suspense><LoginInner/></Suspense>
}
