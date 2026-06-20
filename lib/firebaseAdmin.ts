import { getApps, initializeApp, cert, App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { NextRequest } from 'next/server'

let adminApp: App
if (!getApps().length) {
  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
    })
  })
} else {
  adminApp = getApps()[0]!
}
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)

// Verify Firebase ID token and require admin role
export async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) throw new Error('No auth token')
  const decoded = await adminAuth.verifyIdToken(token, true)
  if ((decoded as any).role !== 'admin') throw new Error('Admin only')
  return decoded
}
