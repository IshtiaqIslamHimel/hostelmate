import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, requireAdmin } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { uid } = await req.json()
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

    // Delete Auth user
    await adminAuth.deleteUser(uid)
    // Delete Firestore profile
    await adminDb.collection('users').doc(uid).delete()
    // Optional: clean up related data (leave completions/swaps for audit)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 })
  }
}
