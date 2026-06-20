import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, requireAdmin } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { name, email, password, role = 'member', roomId = null, telegram_chat_id = null } = await req.json()
    if (!email || !password || !name) return NextResponse.json({ error: 'name/email/password required' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({ email, password, displayName: name, emailVerified: true })
    await adminAuth.setCustomUserClaims(userRecord.uid, { role })

    // Force token refresh on next sign-in by setting emailVerified
    // Firestore profile
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      name, email, role,
      roomId: roomId || null,
      telegram_chat_id: telegram_chat_id || null,
      createdAt: new Date().toISOString(),
      disabled: false,
    })

    return NextResponse.json({ ok: true, uid: userRecord.uid })
  } catch (e:any) {
    const msg = e.message || 'failed'
    if (msg.includes('email-already-exists')) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    const status = msg.includes('Admin') || msg.includes('auth') ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
