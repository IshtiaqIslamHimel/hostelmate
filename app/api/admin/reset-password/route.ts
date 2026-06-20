import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, requireAdmin } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { uid, newPassword } = await req.json()
    if (!uid || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'uid and newPassword (min 6 chars) required' }, { status: 400 })
    }
    await adminAuth.updateUser(uid, { password: newPassword })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 })
  }
}
