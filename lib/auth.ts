import { auth, db } from './firebaseClient'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User, sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

export type Profile = {
  uid: string
  name: string
  email: string
  role: 'admin' | 'member'
  roomId: string | null
  telegram_chat_id?: string | null
}

export function useAuthProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) { setProfile(null); setLoading(false); return }
      // force refresh token to get custom claims
      await u.getIdToken(true).catch(()=>{})
      const snap = await getDoc(doc(db, 'users', u.uid))
      if (snap.exists()) setProfile(snap.data() as Profile)
      else setProfile(null)
      setLoading(false)
    })
  }, [])
  return { user, profile, loading }
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}
export async function signOutUser() {
  return signOut(auth)
}
export async function getIdToken() {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u.getIdToken()
}
export async function adminFetch(url: string, body: any) {
  const token = await getIdToken()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body)
  })
  const j = await res.json().catch(()=>({}))
  if (!res.ok) throw new Error(j.error || 'Request failed')
  return j
}
export async function requestPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email)
}
