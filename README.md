# HostelMate v2 - Firebase + Next.js

Bachelor Hostel Manager. Production-ready.

Features you asked for:
- **Firebase Auth (proper)** – Email/password. Admin creates member accounts via Firebase Admin SDK. Members can only sign in.
- **Firestore backend** – Rooms, members, tasks, completions, swaps, meals, bazar costs
- **Task engine: Room-wise & Member-wise** – Pick any subset of rooms/members for a task. Round-robin: Week 1 Room1, Week 2 Room2… Custom gap days supported (e.g. every 3 days)
- **Swap = Audit Trail** – Swaps are immutable records. Task assignment never mutates. UI shows "Originally Rakib, swapped to Siam (accepted)". All logged in `/swaps`
- **Telegram notifications** – `/api/notify/telegram` + Vercel Cron at `/api/cron/remind` – pings members 1hr before their duty. Set `TELEGRAM_BOT_TOKEN` and link member's telegram_chat_id in Admin > Members
- **Food Costing / Mess Manager** – Meal ON/OFF per member/day, Bazar expense entry, auto Meal Rate = Total Bazar / Total Meals, per-member dues. Mobile-fast UI
- **Vercel ready** – `vercel.json` with cron

### 1. Firebase Setup
1. Create a Firebase project
2. Enable Authentication > Email/Password
3. Enable Firestore (start in production mode, then deploy rules)
4. Create a Web App, copy config to `.env.local` as `NEXT_PUBLIC_FIREBASE_*`
5. Generate a Service Account JSON: Project Settings > Service Accounts > Generate new private key
   Put it in Vercel env as `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (with \n escaped)

Firestore rules: see `firestore.rules`

Seed data: `npm run seed` – creates admin@hostel.local / admin123, 3 rooms, sample tasks, sample members.

### 2. Env

Copy `.env.example` to `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ADMIN_CHAT_ID=...
CRON_SECRET=random-long-string
```

### 3. Run
```
npm install
npm run dev
```
Open http://localhost:3000

First login: admin@hostel.local / admin123

Go to Admin > Members > Create Member. That calls `/api/admin/create-user` which uses Firebase Admin to create the auth user + set custom claim `{role:'member'}` and creates the Firestore profile.

### 4. Deploy to Vercel
- Push to GitHub, Import in Vercel
- Add all env vars
- Build command: `next build`
- The included `vercel.json` enables daily 07:00 Asia/Dhaka cron: `/api/cron/remind`
- Set Vercel Cron secret env = `CRON_SECRET`

### Data Model (Firestore)
```
users/{uid} : {name, email, role:'admin'|'member', roomId|null, telegram_chat_id|null}
rooms/{id} : {name, capacity}
tasks/{id} : {title, description, assignType:'member'|'room', targets: string[], rotation:'round_robin'|'all', repeat:'once'|'daily'|'weekly'|'custom', intervalDays:number, startDate:'YYYY-MM-DD'}
completions/{taskId_date_assignee} : {taskId, date, assigneeKey, done, doneBy, doneAt}
swaps/{id} : {taskId, date, fromUserId, toUserId, status:'pending'|'accepted'|'rejected', createdAt, resolvedAt|null} // IMMUTABLE audit
meals/{userId_date} : {userId, date, lunch:boolean, dinner:boolean}
bazar/{id} : {date, amount, note, addedBy, createdAt}
```

Task assignee resolver is in `lib/schedule.ts` – same logic as v1, fully server-compatible.

Swap audit: Completions are always logged against the original `assigneeKey`. Swaps are a separate collection, never rewrite tasks. UI merges them: "Duty: Room 101 (swapped to Siam)".

Telegram: `/api/notify/telegram` POST {chat_id, text}. Cron job finds todays tasks and sends to any member with `telegram_chat_id` set.

Food Costing: Admin > Costs. Enter bazar expenses. Meal Rate auto-calculates for selected month. Per-member: meals_eaten × rate = due.

Mobile: Fully responsive, bottom tab bar on mobile, large tap targets, PWA manifest included.

---
MIT
