'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOutUser, useAuthProfile } from '@/lib/auth'
import { useEffect } from 'react'

const memberNav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tasks', label: 'My Tasks' },
  { href: '/food', label: 'Food' },
  { href: '/swaps', label: 'Swaps' },
  { href: '/board', label: 'Board' },
]
const adminNav = [
  { href: '/admin/rooms', label: 'Rooms' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/tasks', label: 'Tasks' },
  { href: '/admin/logs', label: 'Logs' },
  { href: '/admin/costs', label: 'Costs' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, loading } = useAuthProfile()

  const isAdminRoute = pathname.startsWith('/admin')

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !profile) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [loading, profile, pathname, router])

  // Redirect non-admins away from admin routes
  useEffect(() => {
    if (!loading && profile && isAdminRoute && profile.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [loading, profile, isAdminRoute, router])

  // Show loading gate – prevents flash of protected content
  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f6f7fb]">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    )
  }

  // Block admin pages for members
  if (isAdminRoute && profile.role !== 'admin') {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f6f7fb]">
        <div className="text-slate-500 text-sm">Checking access…</div>
      </div>
    )
  }

  const isAdmin = profile.role === 'admin'

  const NavLinks = () => (
    <>
      {memberNav.map(n => (
        <Link key={n.href} href={n.href} className={`px-3 py-2 rounded-xl text-sm font-medium ${pathname===n.href ? 'bg-indigo-50 text-brand' : 'text-slate-600 hover:bg-slate-100'}`}>{n.label}</Link>
      ))}
      {isAdmin && <div className="h-px bg-slate-200 my-2" />}
      {isAdmin && adminNav.map(n => (
        <Link key={n.href} href={n.href} className={`px-3 py-2 rounded-xl text-sm font-medium ${pathname===n.href ? 'bg-indigo-50 text-brand' : 'text-slate-600 hover:bg-slate-100'}`}>{n.label}</Link>
      ))}
    </>
  )

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-extrabold text-brand text-lg"><span className="w-8 h-8 bg-brand rounded-lg text-white grid place-items-center text-sm">HM</span> HostelMate</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-slate-600">{profile.name}</span>
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-brand text-xs font-bold">{profile.role}</span>
            <button onClick={()=>signOutUser()} className="btn btn-secondary !py-1.5 !px-3 text-xs">Logout</button>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-6 md:flex md:gap-6 pb-24 md:pb-6">
        <aside className="hidden md:block w-56 shrink-0">
          <nav className="card !p-3 flex flex-col gap-1 sticky top-20"><NavLinks /></nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex justify-around text-[11px] z-40">
        {memberNav.map(n => (
          <Link key={n.href} href={n.href} className={`${pathname===n.href?'text-brand font-bold':'text-slate-600'}`}>{n.label.split(' ')[0]}</Link>
        ))}
        {isAdmin && <Link href="/admin/logs" className={`${pathname.startsWith('/admin')?'text-brand font-bold':'text-slate-600'}`}>Admin</Link>}
      </nav>
    </div>
  )
}
