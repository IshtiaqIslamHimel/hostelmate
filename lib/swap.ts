// lib/swap.ts – client + server safe
import type { TaskDoc } from './schedule'

export type SwapDoc = {
  id: string
  taskId: string
  date: string
  fromUserId: string
  toUserId: string
  status: 'pending' | 'accepted' | 'rejected'
}

export type UserLite = { name?: string, roomId?: string | null }
export type RoomLite = { name?: string }

export function findAcceptedSwap(
  taskId: string,
  date: string,
  originalAssignee: string,
  assignType: 'member' | 'room',
  swaps: SwapDoc[],
  usersMap: Record<string, UserLite>
): SwapDoc | null {
  return swaps.find(s =>
    s.taskId === taskId &&
    s.date === date &&
    s.status === 'accepted' &&
    (
      (assignType === 'member' && s.fromUserId === originalAssignee) ||
      (assignType === 'room' && usersMap[s.fromUserId]?.roomId === originalAssignee)
    )
  ) || null
}

export function resolveEffective(
  task: TaskDoc,
  date: string,
  originalAssignee: string,
  swaps: SwapDoc[],
  usersMap: Record<string, UserLite>
): { kind: 'member' | 'room', id: string, swap: SwapDoc | null } {
  const swap = findAcceptedSwap(task.id, date, originalAssignee, task.assignType, swaps, usersMap)
  if (swap) {
    return { kind: 'member', id: swap.toUserId, swap }
  }
  return { kind: task.assignType, id: originalAssignee, swap: null }
}

export function isDutyMine(
  effectiveKind: 'member' | 'room',
  effectiveId: string,
  myUid: string,
  myRoomId: string | null
): boolean {
  if (effectiveKind === 'member') return effectiveId === myUid
  return myRoomId !== null && effectiveId === myRoomId
}

export function assigneeDisplay(
  kind: 'member' | 'room',
  id: string,
  users: Record<string, UserLite>,
  rooms: Record<string, RoomLite>
): string {
  if (kind === 'member') return users[id]?.name || id
  return rooms[id]?.name || id
}
