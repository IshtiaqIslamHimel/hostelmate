import { adminAuth, adminDb } from '../lib/firebaseAdmin'

async function upsertUser(email:string, password:string, name:string, role:'admin'|'member', roomId:string|null=null){
  let uid:string
  try {
    const u = await adminAuth.getUserByEmail(email)
    uid = u.uid
    console.log('exists', email)
  } catch {
    const u = await adminAuth.createUser({ email, password, displayName: name, emailVerified:true })
    uid = u.uid
    console.log('created', email)
  }
  await adminAuth.setCustomUserClaims(uid, { role })
  await adminDb.collection('users').doc(uid).set({ uid, name, email, role, roomId, telegram_chat_id: null, createdAt: new Date().toISOString() }, {merge:true})
  return uid
}

async function run(){
  const r1 = 'room_101', r2='room_102', r3='room_103'
  await adminDb.collection('rooms').doc(r1).set({name:'Room 101', capacity:3})
  await adminDb.collection('rooms').doc(r2).set({name:'Room 102', capacity:2})
  await adminDb.collection('rooms').doc(r3).set({name:'Room 103', capacity:2})

  await upsertUser('admin@hostel.local','admin123','Hostel Admin','admin', null)
  const u1 = await upsertUser('rakib@hostel.local','123456','Rakib','member', r1)
  const u2 = await upsertUser('siam@hostel.local','123456','Siam','member', r1)
  const u3 = await upsertUser('fahim@hostel.local','123456','Fahim','member', r2)
  const u4 = await upsertUser('nafis@hostel.local','123456','Nafis','member', r2)
  const u5 = await upsertUser('tanvir@hostel.local','123456','Tanvir','member', r3)

  const today = new Date().toISOString().slice(0,10)
  const tasks = [
    { title:'Kitchen / Trash', description:'Clean kitchen, take out trash', assignType:'room', targets:[r1,r2], rotation:'round_robin', repeat:'weekly', intervalDays:7, startDate: today },
    { title:'Bathroom Cleaning', description:'Wash common bathroom', assignType:'member', targets:[u1,u3,u5], rotation:'round_robin', repeat:'custom', intervalDays:3, startDate: today },
    { title:'Buy Drinking Water', description:'Refill 5 gal', assignType:'member', targets:[u1,u2,u3,u4,u5], rotation:'round_robin', repeat:'weekly', intervalDays:7, startDate: today },
  ]
  for(const t of tasks){ await adminDb.collection('tasks').add(t) }
  console.log('Seed done.')
  process.exit(0)
}
run()
