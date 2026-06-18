import { describe, it, expect } from 'vitest'
import {
  computePlannedMinutesBySection,
  computeCapacityAwareBlocks,
  computeAwakeMinutes,
  computeBlocksFromDurations,
  isSleepTime,
  getActiveSectionIds,
} from './sectionTimeBlocks'
import type { BlockDurations, Task, TaskSectionId } from './types'

// ── helpers ──────────────────────────────────────────────────────────────────

let seq = 0
function task(sectionId: TaskSectionId, overrides: Partial<Task> = {}): Task {
  seq += 1
  return {
    id: `t${seq}`,
    title: 'task',
    sectionId,
    date: '2026-06-18',
    isDone: false,
    ...overrides,
  }
}

const FLOORS: BlockDurations = {
  morningRoutine: 60,
  highPriority: 120,
  mediumPriority: 120,
  lowPriority: 120,
  nightRoutine: 60,
}

// ── computePlannedMinutesBySection ────────────────────────────────────────────

describe('computePlannedMinutesBySection', () => {
  it('folds Top 3 (mustDo) into the highPriority bucket', () => {
    const planned = computePlannedMinutesBySection([task('mustDo', { durationMinutes: 60 })])
    expect(planned.highPriority).toBe(60)
  })

  it('accumulates mustDo and highPriority into the same bucket', () => {
    const planned = computePlannedMinutesBySection([
      task('mustDo', { durationMinutes: 60 }),
      task('highPriority', { durationMinutes: 45 }),
    ])
    expect(planned.highPriority).toBe(105)
  })

  it('excludes subtasks (parentId set)', () => {
    const planned = computePlannedMinutesBySection([
      task('highPriority', { durationMinutes: 45 }),
      task('highPriority', { durationMinutes: 999, parentId: 't1' }),
    ])
    expect(planned.highPriority).toBe(45)
  })

  it('excludes side quests from every bucket', () => {
    const planned = computePlannedMinutesBySection([task('sideQuest', { durationMinutes: 90 })])
    const total = Object.values(planned).reduce((a, b) => a + b, 0)
    expect(total).toBe(0)
  })

  it('uses the per-section default when a task has no duration', () => {
    const planned = computePlannedMinutesBySection([task('highPriority')])
    expect(planned.highPriority).toBe(45) // DEFAULT_TASK_MINUTES_BY_SECTION.highPriority
  })

  it('uses the mustDo default (30) for a duration-less Top 3 task', () => {
    const planned = computePlannedMinutesBySection([task('mustDo')])
    expect(planned.highPriority).toBe(30)
  })

  it('treats an explicit 0 duration as zero, not as "missing"', () => {
    const planned = computePlannedMinutesBySection([task('highPriority', { durationMinutes: 0 })])
    expect(planned.highPriority).toBe(0)
  })

  it('still counts completed tasks (plan stays stable through the day)', () => {
    const planned = computePlannedMinutesBySection([task('mustDo', { durationMinutes: 60, isDone: true })])
    expect(planned.highPriority).toBe(60)
  })

  it('returns all-zero for an empty task list', () => {
    expect(computePlannedMinutesBySection([])).toEqual({
      morningRoutine: 0, highPriority: 0, mediumPriority: 0, lowPriority: 0, nightRoutine: 0,
    })
  })
})

// ── computeCapacityAwareBlocks ────────────────────────────────────────────────

describe('computeCapacityAwareBlocks', () => {
  const planned = (o: Partial<BlockDurations> = {}): BlockDurations => ({
    morningRoutine: 0, highPriority: 0, mediumPriority: 0, lowPriority: 0, nightRoutine: 0, ...o,
  })

  it('fits without compression when the plan is under capacity', () => {
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned(), FLOORS)
    expect(r.compressed).toEqual({ mediumPriority: false, lowPriority: false })
    expect(r.overByMinutes).toBe(0)
    expect(r.durations).toEqual(FLOORS)
    expect(r.freeMinutes).toBe(960 - 480)
    expect(r.projectedLightsOutMin).toBe(900) // 07:00 + 480 min = 15:00
  })

  it('compresses Low before Medium', () => {
    // awake 960, focusCapacity = 960 - 60 - 60 = 840; high+med+low = 600+200+200 = 1000 → over 160
    const floors: BlockDurations = { ...FLOORS, highPriority: 600, mediumPriority: 200, lowPriority: 200 }
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned(), floors)
    expect(r.compressed).toEqual({ lowPriority: true, mediumPriority: false })
    expect(r.durations.lowPriority).toBe(40) // 200 - 160
    expect(r.durations.mediumPriority).toBe(200) // untouched
    expect(r.durations.highPriority).toBe(600) // protected
    expect(r.overByMinutes).toBe(0)
  })

  it('compresses Medium too when Low alone is not enough', () => {
    // over = 700+200+200 - 840 = 260; low → 15 (cut 185), remaining 75 from medium → 125
    const floors: BlockDurations = { ...FLOORS, highPriority: 700, mediumPriority: 200, lowPriority: 200 }
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned(), floors)
    expect(r.compressed).toEqual({ lowPriority: true, mediumPriority: true })
    expect(r.durations.lowPriority).toBe(15)
    expect(r.durations.mediumPriority).toBe(125)
    expect(r.overByMinutes).toBe(0)
  })

  it('never shrinks High, and reports overByMinutes when the plan cannot fit', () => {
    // High alone (900) blows the focus capacity; Low+Medium floored at 15 each, still over.
    const floors: BlockDurations = { ...FLOORS, highPriority: 900, mediumPriority: 200, lowPriority: 200 }
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned(), floors)
    expect(r.durations.highPriority).toBe(900) // protected, never compressed
    expect(r.durations.lowPriority).toBe(15)
    expect(r.durations.mediumPriority).toBe(15)
    expect(r.overByMinutes).toBe(90) // 1050 planned - 960 awake
    expect(r.freeMinutes).toBe(0)
    expect(r.projectedLightsOutMin).toBe(30) // wraps past midnight: 07:00 + 1050 = 00:30
  })

  it('honors a floorsOverride instead of the wake/sleep default split', () => {
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned(), FLOORS)
    expect(r.durations.morningRoutine).toBe(60)
    expect(r.durations.nightRoutine).toBe(60)
  })
})

// ── computeAwakeMinutes ───────────────────────────────────────────────────────

describe('computeAwakeMinutes', () => {
  it('computes a normal day', () => {
    expect(computeAwakeMinutes('07:00', '23:00')).toBe(960)
  })

  it('handles a sleep target past midnight', () => {
    expect(computeAwakeMinutes('22:00', '06:00')).toBe(480)
  })

  it('treats equal wake/sleep as a full day (never 0)', () => {
    expect(computeAwakeMinutes('07:00', '07:00')).toBe(1439)
  })

  it('does not return NaN for malformed time strings', () => {
    expect(Number.isNaN(computeAwakeMinutes('xx', 'yy'))).toBe(false)
  })
})

// ── isSleepTime / getActiveSectionIds (with computed blocks) ──────────────────

describe('block-relative time helpers', () => {
  // 07:00 wake → morning 420-480, high 480-600, medium 600-720, low 720-840, night 840-900.
  const blocks = computeBlocksFromDurations('07:00', FLOORS)

  it('detects sleep time outside the awake window', () => {
    expect(isSleepTime(960, undefined, blocks)).toBe(true) // 16:00 is after 15:00 lights-out
    expect(isSleepTime(300, undefined, blocks)).toBe(true) // 05:00 is before 07:00 wake
    expect(isSleepTime(540, undefined, blocks)).toBe(false) // 09:00 is awake
  })

  it('maps the current minute to the active section', () => {
    expect(getActiveSectionIds(540, undefined, blocks)).toEqual(['highPriority']) // 09:00
    expect(getActiveSectionIds(450, undefined, blocks)).toEqual(['morningRoutine']) // 07:30
    expect(getActiveSectionIds(960, undefined, blocks)).toEqual([]) // sleep → none
  })
})
