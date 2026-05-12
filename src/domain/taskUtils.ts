import type { Task } from './types'

export function createTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Reorder array: move item at fromIndex to toIndex (0 = top). */
export function reorderTasks<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return arr
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= arr.length) return arr
  const copy = [...arr]
  const [removed] = copy.splice(fromIndex, 1)
  // After splicing out fromIndex, every item after it shifts down by 1.
  // When dragging downward (fromIndex < toIndex), toIndex must be adjusted accordingly.
  const adjustedInsert = fromIndex < toIndex ? toIndex - 1 : toIndex
  const insertIdx = Math.min(adjustedInsert, copy.length)
  copy.splice(insertIdx, 0, removed)
  return copy
}

/** Section tasks in display order: roots first (array order), then each root's children. */
export function getOrderedTasksForSection(tasks: Task[]): Task[] {
  const roots = tasks.filter((t) => !t.parentId)
  const ordered: Task[] = []
  for (const r of roots) {
    ordered.push(r)
    ordered.push(...tasks.filter((t) => t.parentId === r.id))
  }
  return ordered
}

/** Collect all descendant task ids (children, grandchildren, ...). */
export function getDescendantIds(tasks: Task[], parentId: string): Set<string> {
  const set = new Set<string>()
  const collect = (pid: string) => {
    for (const t of tasks) {
      if (t.parentId === pid) {
        set.add(t.id)
        collect(t.id)
      }
    }
  }
  collect(parentId)
  return set
}

/**
 * Clone tasks for another day: new IDs, same content, parentId remapped.
 * When resetTimes is true, scheduledAt and durationMinutes are cleared.
 */
export function cloneTasksForDay(
  tasks: Task[],
  targetDate: string,
  options?: { resetTimes?: boolean },
): Task[] {
  const idMap = new Map<string, string>()
  const resetTimes = options?.resetTimes ?? false
  const cloned = tasks.map((t) => {
    const newId = createTaskId()
    idMap.set(t.id, newId)
    const base = { ...t, id: newId, date: targetDate, isDone: false }
    if (resetTimes) {
      return { ...base, scheduledAt: undefined, durationMinutes: undefined }
    }
    return base
  })
  return cloned.map((t) => ({
    ...t,
    parentId: t.parentId ? (idMap.get(t.parentId) ?? undefined) : undefined,
  }))
}
