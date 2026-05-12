import { describe, it, expect } from 'vitest'
import { reorderTasks, getOrderedTasksForSection, getDescendantIds, cloneTasksForDay } from './taskUtils'
import type { Task } from './types'

// ── helpers ─────────────────────────────────────────────────────────────────

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    sectionId: 'highPriority',
    date: '2026-05-12',
    isDone: false,
    ...overrides,
  }
}

// ── reorderTasks ─────────────────────────────────────────────────────────────

describe('reorderTasks', () => {
  it('returns same array when fromIndex === toIndex', () => {
    const arr = ['a', 'b', 'c']
    expect(reorderTasks(arr, 1, 1)).toBe(arr)
  })

  it('returns same array for out-of-bounds fromIndex', () => {
    const arr = ['a', 'b']
    expect(reorderTasks(arr, 5, 0)).toEqual(['a', 'b'])
  })

  it('moves item UP correctly (drag last to first)', () => {
    expect(reorderTasks(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('moves item UP one step', () => {
    expect(reorderTasks(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
  })

  it('moves item DOWN correctly (drag first to last above-position)', () => {
    // drag 'a' above 'd' (toIndex=3) → result: [b, c, a, d]
    expect(reorderTasks(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves item DOWN one step', () => {
    // drag 'a' below 'b' (toIndex=2, below index 1) → [b, a, c]
    expect(reorderTasks(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'a', 'c'])
  })

  it('drag first item to end (below last)', () => {
    // "below d" → toIndex = 4 (d.index+1)
    expect(reorderTasks(['a', 'b', 'c', 'd'], 0, 4)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('drag last item to just-above-last (no-op in effect)', () => {
    // drag 'c' above 'c' itself gives same position
    expect(reorderTasks(['a', 'b', 'c'], 2, 2)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate original array', () => {
    const arr = ['a', 'b', 'c']
    reorderTasks(arr, 0, 2)
    expect(arr).toEqual(['a', 'b', 'c'])
  })
})

// ── getOrderedTasksForSection ────────────────────────────────────────────────

describe('getOrderedTasksForSection', () => {
  it('returns empty for empty input', () => {
    expect(getOrderedTasksForSection([])).toEqual([])
  })

  it('returns roots only when no subtasks', () => {
    const tasks = [task('a'), task('b'), task('c')]
    expect(getOrderedTasksForSection(tasks).map(t => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('places children immediately after their parent', () => {
    const parent = task('p')
    const child1 = task('c1', { parentId: 'p' })
    const child2 = task('c2', { parentId: 'p' })
    const other = task('o')
    const result = getOrderedTasksForSection([parent, child1, child2, other])
    expect(result.map(t => t.id)).toEqual(['p', 'c1', 'c2', 'o'])
  })

  it('handles multiple parents each with children', () => {
    const p1 = task('p1')
    const p2 = task('p2')
    const c1 = task('c1', { parentId: 'p1' })
    const c2 = task('c2', { parentId: 'p2' })
    const result = getOrderedTasksForSection([p1, c1, p2, c2])
    expect(result.map(t => t.id)).toEqual(['p1', 'c1', 'p2', 'c2'])
  })
})

// ── getDescendantIds ─────────────────────────────────────────────────────────

describe('getDescendantIds', () => {
  it('returns empty set when no descendants', () => {
    const tasks = [task('a'), task('b')]
    expect(getDescendantIds(tasks, 'a').size).toBe(0)
  })

  it('returns direct children', () => {
    const tasks = [task('p'), task('c1', { parentId: 'p' }), task('c2', { parentId: 'p' })]
    expect(getDescendantIds(tasks, 'p')).toEqual(new Set(['c1', 'c2']))
  })

  it('returns grandchildren recursively', () => {
    const tasks = [
      task('p'),
      task('c', { parentId: 'p' }),
      task('gc', { parentId: 'c' }),
    ]
    expect(getDescendantIds(tasks, 'p')).toEqual(new Set(['c', 'gc']))
  })

  it('does not include tasks from unrelated subtrees', () => {
    const tasks = [
      task('p1'),
      task('c1', { parentId: 'p1' }),
      task('p2'),
      task('c2', { parentId: 'p2' }),
    ]
    expect(getDescendantIds(tasks, 'p1')).toEqual(new Set(['c1']))
  })
})

// ── cloneTasksForDay ─────────────────────────────────────────────────────────

describe('cloneTasksForDay', () => {
  it('assigns new IDs to all cloned tasks', () => {
    const original = [task('a'), task('b')]
    const cloned = cloneTasksForDay(original, '2026-05-13')
    expect(cloned[0]!.id).not.toBe('a')
    expect(cloned[1]!.id).not.toBe('b')
    expect(cloned[0]!.id).not.toBe(cloned[1]!.id)
  })

  it('updates date on all cloned tasks', () => {
    const original = [task('a'), task('b')]
    const cloned = cloneTasksForDay(original, '2026-05-20')
    expect(cloned.every(t => t.date === '2026-05-20')).toBe(true)
  })

  it('resets isDone to false', () => {
    const original = [task('a', { isDone: true })]
    const cloned = cloneTasksForDay(original, '2026-05-13')
    expect(cloned[0]!.isDone).toBe(false)
  })

  it('remaps parentId to new cloned ID', () => {
    const parent = task('p')
    const child = task('c', { parentId: 'p' })
    const cloned = cloneTasksForDay([parent, child], '2026-05-13')
    const clonedParent = cloned.find(t => !t.parentId)!
    const clonedChild = cloned.find(t => t.parentId)!
    expect(clonedChild.parentId).toBe(clonedParent.id)
  })

  it('clears scheduledAt and durationMinutes when resetTimes is true', () => {
    const original = [task('a', { scheduledAt: '09:00', durationMinutes: 60 })]
    const cloned = cloneTasksForDay(original, '2026-05-13', { resetTimes: true })
    expect(cloned[0]!.scheduledAt).toBeUndefined()
    expect(cloned[0]!.durationMinutes).toBeUndefined()
  })

  it('preserves scheduledAt and durationMinutes when resetTimes is false', () => {
    const original = [task('a', { scheduledAt: '09:00', durationMinutes: 60 })]
    const cloned = cloneTasksForDay(original, '2026-05-13', { resetTimes: false })
    expect(cloned[0]!.scheduledAt).toBe('09:00')
    expect(cloned[0]!.durationMinutes).toBe(60)
  })
})
