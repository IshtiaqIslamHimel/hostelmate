'use client'
import AppShell from '@/components/AppShell'
import { adminFetch, useAuthProfile } from '@/lib/auth'
import { db } from '@/lib/firebaseClient'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useRef, useState } from 'react'

type Post = { id:string; text:string; authorId:string; authorName:string; authorRole:string; createdAt:any; pinned?:boolean; source?:string }

export default function BoardPage(){
  const { profile } = useAuthProfile()
  const [posts, setPosts] = useState<Post[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [tgStatus, setTgStatus] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    const q = query(collection(db, 'board'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap=> setPosts(snap.docs.map(d=> ({id:d.id, ...d.data()} as Post))))
    return ()=>unsub()
  }, [])

  const send = async () => {
    if(!profile || !text.trim() || sending) return
    setSending(true); setTgStatus('')
    try {
      await addDoc(collection(db,'board'), {
        text: text.trim().slice(0,2000),
        authorId: profile.uid, authorName: profile.name, authorRole: profile.role,
        createdAt: serverTimestamp(), pinned: false, source: 'web',
      })
      const msgText = text.trim()
      setText('')
      // Telegram forward – show result
      try {
        const r = await adminFetch('/api/board/notify', { text: msgText, authorName: profile.name })
        setTgStatus(r.telegram?.ok ? '✓ Posted to Telegram group' : 'Telegram: ' + (r.telegram?.error || 'failed'))
      } catch(e:any){
        setTgStatus('Telegram failed: ' + e.message)
      }
      setTimeout(()=>setTgStatus(''), 4000)
      bottomRef.current?.scrollIntoView({behavior:'smooth'})
    } catch(e:any){ alert(e.message) }
    setSending(false)
  }

  const del = async (id:string, authorId:string) => {
    if(!profile) return
    if (profile.role !== 'admin' && authorId !== profile.uid) return alert('You can only delete your own messages')
    if(!confirm('Delete this message?')) return
    await deleteDoc(doc(db, 'board', id))
  }
  const togglePin = async (p: Post) => {
    if(profile?.role !== 'admin') return
    await updateDoc(doc(db,'board', p.id), { pinned: !p.pinned })
  }

  if(!profile) return null
  const pinned = posts.filter(p=>p.pinned)
  const rest = posts.filter(p=>!p.pinned)

  return <AppShell>
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
      <div>
        <h1 className="text-2xl font-extrabold">Board</h1>
        <p className="text-slate-500 text-sm">Hostel announcements & chat – admin and members can post. Posts auto-forward to Telegram group.</p>
      </div>
      <TelegramLinkCard profile={profile} />
    </div>

    {pinned.length > 0 && (
      <div className="card mb-3 !bg-amber-50 !border-amber-200">
        <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">📌 Pinned</div>
        <div className="space-y-2">{pinned.map(p=> <PostRow key={p.id} p={p} profile={profile} onDelete={del} onPin={togglePin} />)}</div>
      </div>
    )}

    <div className="card mb-3">
      <textarea className="input min-h-[88px]" placeholder="Write an announcement, meal update, maintenance notice…" value={text} onChange={e=>setText(e.target.value)} maxLength={2000} />
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-slate-500">{text.length}/2000 · {tgStatus || 'Posts sync to Telegram group'}</span>
        <button className="btn" onClick={send} disabled={!text.trim() || sending}>{sending ? 'Posting…' : 'Post'}</button>
      </div>
      {tgStatus && <div className="text-xs mt-2 text-slate-600">{tgStatus}</div>}
    </div>

    <div className="card">
      <h3 className="font-bold mb-3">Recent Posts</h3>
      <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
        {rest.map(p=> <PostRow key={p.id} p={p} profile={profile} onDelete={del} onPin={togglePin} />)}
        {rest.length===0 && pinned.length===0 && <div className="text-slate-500 text-sm">No posts yet. Be the first!</div>}
        <div ref={bottomRef} />
      </div>
    </div>
  </AppShell>
}

function PostRow({p, profile, onDelete, onPin}:{p:Post, profile:any, onDelete:(id:string,authorId:string)=>void, onPin:(p:Post)=>void}) {
  const ts = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null)
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0">
      <div className="flex justify-between gap-3 items-start">
        <div className="flex-1">
          <div className="text-[13px] text-slate-500">
            <b className="text-slate-800">{p.authorName}</b>
            <span className="ml-2 pill !py-0.5 bg-slate-100 text-slate-600">{p.authorRole}</span>
            {p.source==='telegram' && <span className="ml-2 pill !py-0.5 bg-sky-100 text-sky-700">via Telegram</span>}
            <span className="ml-2">{ts ? ts.toLocaleString('en-GB', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : ''}</span>
          </div>
          <div className="whitespace-pre-wrap mt-1 text-[14px]">{p.text}</div>
        </div>
        <div className="text-xs flex gap-2 shrink-0">
          {profile.role==='admin' && <button onClick={()=>onPin(p)} className="text-amber-700 hover:underline">{p.pinned ? 'Unpin' : 'Pin'}</button>}
          {(profile.uid===p.authorId || profile.role==='admin') && <button onClick={()=>onDelete(p.id, p.authorId)} className="text-red-600 hover:underline">Delete</button>}
        </div>
      </div>
    </div>
  )
}

function TelegramLinkCard({profile}:{profile:any}) {
  const [chatId, setChatId] = useState(profile.telegram_chat_id || '')
  const [saving, setSaving] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'your_bot'

  useEffect(()=>{ setChatId(profile.telegram_chat_id || '') }, [profile.telegram_chat_id])

  const save = async () => {
    setSaving(true)
    try {
      const { doc, updateDoc } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebaseClient')
      await updateDoc(doc(db, 'users', profile.uid), { telegram_chat_id: chatId || null })
      setTestMsg('Saved.')
      setTimeout(()=>setTestMsg(''), 1500)
    } catch(e:any){ alert(e.message) }
    setSaving(false)
  }

  const testPing = async (target?: string) => {
    setTestMsg('Sending…')
    try {
      const { adminFetch } = await import('@/lib/auth')
      await adminFetch('/api/telegram/test', target ? { chat_id: target } : {})
      setTestMsg('✅ Check Telegram!')
    } catch(e:any){ setTestMsg('❌ ' + e.message) }
  }

  return (
    <div className="card !p-3 text-xs w-full md:max-w-sm shrink-0">
      <div className="font-bold mb-1">Telegram Notifications</div>
      <div className="text-slate-600 mb-2">
        DM: <a className="text-brand underline" href={`https://t.me/${botUsername}?start=${profile.uid}`} target="_blank" rel="noreferrer">Link Telegram</a> → auto-saves your chat_id<br/>
        Or paste chat_id manually below
      </div>
      <div className="flex gap-2 flex-wrap">
        <input className="input !py-1.5 text-xs flex-1 min-w-[120px]" placeholder="chat_id" value={chatId} onChange={e=>setChatId(e.target.value)} />
        <button className="btn btn-secondary !py-1.5 !px-3 text-xs" disabled={saving} onClick={save}>Save</button>
        <button className="btn btn-secondary !py-1.5 !px-3 text-xs" onClick={()=>testPing()}>Test DM</button>
      </div>
      <button className="btn btn-secondary !py-1.5 !px-3 text-xs mt-2 w-full" onClick={()=>testPing(process.env.NEXT_PUBLIC_TELEGRAM_GROUP_CHAT_ID || '-5458193594')}>Test Group Post</button>
      {testMsg && <div className="mt-1 text-slate-600 break-words">{testMsg}</div>}
      <div className="mt-2 text-[11px] text-slate-500">Swap/ duty DMs → your personal chat_id. Board posts → Telegram group.</div>
    </div>
  )
}