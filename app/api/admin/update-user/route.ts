import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, requireAdmin } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    const { uid, name, email, roomId, telegram_chat_id, disabled, role } = await req.json()
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

    // Prevent admin from demoting/disabling themselves
    if (uid === admin.uid) {
      if (role && role !== 'admin') return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 })
      if (disabled === true) return NextResponse.json({ error: 'Cannot disable your own account' }, { status: 403 })
    }

    const updates: any = {}
    if (name !== undefined) updates.displayName = name
    if (email !== undefined) updates.email = email
    if (typeof disabled === 'boolean') updates.disabled = disabled
    if (Object.keys(updates).length) await adminAuth.updateUser(uid, updates)

    // role change -> custom claims
    if (role === 'admin' || role === 'member') {
      await adminAuth.setCustomUserClaims(uid, { role })
    }

    const profile: any = {}
    if (name !== undefined) profile.name = name
    if (email !== undefined) profile.email = email
    if (roomId !== undefined) profile.roomId = roomId || null
    if (telegram_chat_id !== undefined) profile.telegram_chat_id = telegram_chat_id || null
    if (role !== undefined) profile.role = role
    if (Object.keys(profile).length) {
      await adminDb.collection('users').doc(uid).set(profile, { merge: true })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const msg = e.message || 'failed'
    const status = msg.includes('Admin') || msg.includes('auth') ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
