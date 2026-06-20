export type TaskDoc = {
  id: string
  title: string
  description?: string
  assignType: 'member' | 'room'
  targets: string[]
  rotation: 'round_robin' | 'all'
  repeat: 'once' | 'daily' | 'weekly' | 'custom'
  intervalDays: number
  startDate: string // YYYY-MM-DD
}

export function dateDiffDays(a: string, b: string) {
  return Math.round((new Date(a+'T12:00:00').getTime() - new Date(b+'T12:00:00').getTime()) / 86400000)
}
export function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr+'T12:00:00'); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10)
}
export function todayISO(){
  return new Date().toISOString().slice(0,10)
}

export function getAssigneesForTaskOnDate(task: TaskDoc, dateStr: string): string[] {
  const targets = task.targets || []
  if (targets.length === 0) return []
  const interval = task.repeat === 'once' ? 99999 :
                   task.repeat === 'daily' ? 1 :
                   task.repeat === 'weekly' ? 7 :
                   (task.intervalDays || 1)
  const daysSince = dateDiffDays(dateStr, task.startDate)
  if (daysSince < 0) return []
  if (task.repeat === 'once' && daysSince !== 0) return []
  if (daysSince % interval !== 0) return []
  if (task.rotation === 'all') return targets
  const cycle = Math.floor(daysSince / interval)
  const idx = cycle % targets.length
  return [targets[idx]]
}

export function completionDocId(taskId: string, date: string, assigneeKey: string) {
  return `${taskId}_${date}_${assigneeKey}`
}
