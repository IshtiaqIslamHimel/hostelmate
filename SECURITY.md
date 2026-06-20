# HostelMate – Production Security Checklist

## 1. Firebase – guu-house
- [ ] Authentication → Email/Password → Enabled, **Email enumeration protection ON**
- [ ] Authentication → Settings → Authorized domains: add your Vercel domain only (`hostelmate-xxx.vercel.app`), remove localhost after launch
- [ ] Firestore → Rules → paste `firestore.rules` from repo → Publish
- [ ] Firestore → Indexes: none required (all queries are simple)
- [ ] Project Settings → General → Delete the leaked Service Account key: `private_key_id: 7571be63ce03e497ebe74d8f4d030906c6ff1050`
  - IAM → Service Accounts → firebase-adminsdk-fbsvc@guu-house.iam.gserviceaccount.com → Keys → Delete old key
  - Generate new private key → update Vercel env `FIREBASE_ADMIN_*` + local `.env.local`
- [ ] Auth → Users → admin@hostel.local → change password / use your real email, delete seed members you don't need

## 2. App – Admin User Management
Admin → Members page now has:
- **Create** – Firebase Auth user + custom claim role=member + Firestore profile
- **Edit** – name, email, room, telegram_chat_id, disable/enable login
- **Reset PW** – set a new password instantly
- **Delete** – deletes Auth account AND Firestore profile (completions/swaps kept for audit)

All 4 admin API routes (`/api/admin/create-user`, `update-user`, `reset-password`, `delete-user`) verify Firebase ID token and require `role === 'admin'`. No more open endpoint.

Default seed passwords:
- Admin: `admin@hostel.local / admin123`
- Members: `*@hostel.local / 123456`
Change these immediately in production. Members can also click “Forgot password?” on the login page – Firebase sends a reset email.

## 3. Security headers
`middleware.ts` adds:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## 4. Firestore Rules summary
- users: read:any signed-in, write:admin only (self can edit name/telegram only)
- rooms/tasks/bazar: read:any, write:admin only
- completions: read/write any signed-in (task ticking)
- swaps: create: fromUser must match auth.uid, update: only toUser or admin
- meals: docId = userId_date, write: owner or admin

## 5. Environment variables – Vercel
Set these, never commit `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=guu-house.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=guu-house
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=guu-house.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=405086359251
NEXT_PUBLIC_FIREBASE_APP_ID=1:405086359251:web:9752df5dacf31894a84e26

FIREBASE_ADMIN_PROJECT_ID=guu-house
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-fbsvc@guu-house.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

TELEGRAM_BOT_TOKEN=
CRON_SECRET=<generate: openssl rand -hex 32>
```

In Vercel: Project → Settings → Environment Variables → paste all. For `FIREBASE_ADMIN_PRIVATE_KEY`, paste with real newlines.

## 6. Telegram / Cron
- Bot token in `TELEGRAM_BOT_TOKEN`
- Cron runs at 01:00 UTC = 07:00 Asia/Dhaka via `vercel.json`
- Secret protects `/api/cron/remind`

## 7. PWA
Icons added: `/public/icon-192.png`, `/public/icon-512.png`
Manifest: `/public/manifest.json`

## 8. Deploy
```
git add .
git commit -m "hostelmate v2.1 – admin user management, security hardening"
git push
```
Vercel auto-deploys.

After first deploy:
- [ ] Login with admin@hostel.local / admin123 → immediately change password via Firebase Console
- [ ] Delete seed members, create real ones with Admin → Members → Create Account
- [ ] Test: edit member, reset password, disable, delete
- [ ] Test member login → Forgot password flow
- [ ] Enable 2FA on your Firebase / Google account

## 9. What’s hardened vs v2.0
- ✅ Admin API routes now verify Firebase ID token + admin role – was open before
- ✅ Full member management: Edit / Reset PW / Disable / Delete
- ✅ Firestore rules tightened: users can only edit own name/telegram, swaps enforce fromUserId
- ✅ Security headers via middleware.ts
- ✅ Login page: Forgot password (Firebase sendPasswordResetEmail)
- ✅ PWA icons, themeColor warning fixed
- ✅ Seed script works without dotenv: `tsx --env-file=.env.local`
- ✅ Password minimum 6 chars enforced server-side

The app is production-ready for guu-house.
