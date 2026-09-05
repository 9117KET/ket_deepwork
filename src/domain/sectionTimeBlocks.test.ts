import { describe, it, expect } from 'vitest'
import {
  applyBlockDurationChange,
  computePlannedMinutesBySection,
  computeCapacityAwareBlocks,
  computeAwakeMinutes,
  computeBlocksFromDurations,
  computeBlocksFromWakeSleep,
  computeSleepWindow,
  sleepMinutesFromTarget,
  sleepTargetFromMinutes,
  isSleepTime,
  getActiveSectionIds,
  getSectionTimeframeLabel,
  NONEMPTY_BLOCK_MIN_MINUTES,
  type DayBlocks,
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

// ── computeCapacityAwareBlocks (demand-first, simple bedtime) ─────────────────
//
// All scenarios use a 07:00→23:00 day (awake 960, target bedtime 23:00) and
// FLOORS, so morning/night floors are 60 each. Work blocks size to demand only —
// no surplus padding — and the bedtime stays at the 23:00 target until the planned
// work runs past it.

describe('computeCapacityAwareBlocks (demand-first)', () => {
  const planned = (o: Partial<BlockDurations> = {}): BlockDurations => ({
    morningRoutine: 0, highPriority: 0, mediumPriority: 0, lowPriority: 0, nightRoutine: 0, ...o,
  })

  it('collapses every empty work block to 0 (no phantom reservations)', () => {
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned(), FLOORS)
    expect(r.durations.highPriority).toBe(0)
    expect(r.durations.mediumPriority).toBe(0)
    expect(r.durations.lowPriority).toBe(0)
    expect(r.durations.morningRoutine).toBe(60) // routine floor
    expect(r.durations.nightRoutine).toBe(60)   // routine floor
    expect(r.overByMinutes).toBe(0)
    expect(r.projectedLightsOutMin).toBe(1380) // light day → stays at the 23:00 target
  })

  it('sizes a populated block to exactly its task demand (no padding)', () => {
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned({ highPriority: 60 }), FLOORS)
    expect(r.durations.highPriority).toBe(60) // not inflated toward any cap
    expect(r.durations.mediumPriority).toBe(0) // empty → hidden
    expect(r.durations.lowPriority).toBe(0)
    expect(r.overByMinutes).toBe(0)
    expect(r.projectedLightsOutMin).toBe(1380) // still fits before 23:00 → target
  })

  it('keeps full demand when a block exceeds its old cap (no ceiling anymore)', () => {
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned({ highPriority: 300 }), FLOORS)
    expect(r.durations.highPriority).toBe(300)
    expect(r.durations.mediumPriority).toBe(0)
    expect(r.overByMinutes).toBe(0)
  })

  it('leaves empty blocks at 0 and sizes populated ones to demand', () => {
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned({ highPriority: 30, mediumPriority: 45 }), FLOORS)
    expect(r.durations.highPriority).toBe(30)
    expect(r.durations.mediumPriority).toBe(45)
    expect(r.durations.lowPriority).toBe(0) // empty → hidden
  })

  it('applies the non-empty minimum width to a tiny task', () => {
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned({ lowPriority: 10 }), FLOORS)
    expect(r.durations.highPriority).toBe(0)
    expect(r.durations.mediumPriority).toBe(0)
    expect(r.durations.lowPriority).toBe(NONEMPTY_BLOCK_MIN_MINUTES) // 10 → 30
  })

  it('slips the bedtime past the target and reports overByMinutes when work overflows', () => {
    // morning 60 + high 600 + medium 200 + low 200 + night 60 = 1120 > 960 awake.
    const r = computeCapacityAwareBlocks(
      '07:00', '23:00',
      planned({ highPriority: 600, mediumPriority: 200, lowPriority: 200 }),
      FLOORS,
    )
    expect(r.durations.highPriority).toBe(600) // demand kept as-is, never compressed
    expect(r.durations.mediumPriority).toBe(200)
    expect(r.durations.lowPriority).toBe(200)
    expect(r.overByMinutes).toBe(160) // 1120 planned - 960 awake
    expect(r.projectedLightsOutMin).toBe(100) // 07:00 + 1120 = 01:40, wrapped
  })

  it('expands a routine block to fit its tasks above the floor', () => {
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned({ morningRoutine: 120 }), FLOORS)
    expect(r.durations.morningRoutine).toBe(120) // floor 60 expanded to fit 120
    expect(r.durations.nightRoutine).toBe(60)
  })

  it('ignores floorsOverride work-block sizes (floors no longer reserve work time)', () => {
    // A big High floor must NOT reserve High time when there are no High tasks.
    const floors: BlockDurations = { ...FLOORS, highPriority: 999 }
    const r = computeCapacityAwareBlocks('07:00', '23:00', planned(), floors)
    expect(r.durations.highPriority).toBe(0)
    expect(r.durations.morningRoutine).toBe(60) // morning/night floors still honored
    expect(r.durations.nightRoutine).toBe(60)
  })
})

// ── getSectionTimeframeLabel (empty blocks) ───────────────────────────────────

describe('getSectionTimeframeLabel with computed blocks', () => {
  it('returns null for a zero-width (empty) block', () => {
    const blocks = computeBlocksFromDurations('07:00', {
      morningRoutine: 60, highPriority: 240, mediumPriority: 0, lowPriority: 0, nightRoutine: 60,
    })
    expect(getSectionTimeframeLabel('mediumPriority', undefined, blocks)).toBeNull()
    expect(getSectionTimeframeLabel('lowPriority', undefined, blocks)).toBeNull()
    expect(getSectionTimeframeLabel('highPriority', undefined, blocks)).not.toBeNull()
  })
})

// ── computeBlocksFromWakeSleep (degenerate awake windows) ─────────────────────

describe('computeBlocksFromWakeSleep with a tiny awake window', () => {
  it('never allocates more block time than the awake window has', () => {
    // Awake 07:00→08:00 = 60 min: morning 30 + night 30 leaves a 0-min focus
    // pool. The old fixed 15-min medium/low floors overflowed the window.
    const blocks = computeBlocksFromWakeSleep('07:00', '08:00')
    const total = blocks.reduce(
      (sum, b) => sum + ((b.end - b.start + 1440) % 1440 === 0 ? 0 : (b.end - b.start + 1440) % 1440),
      0,
    )
    expect(total).toBeLessThanOrEqual(60)
  })

  it('keeps the normal split for a regular day', () => {
    // Awake 07:00→23:00 = 960: routines 45 + 30 by default, focus 885.
    const blocks = computeBlocksFromWakeSleep('07:00', '23:00')
    const dur = (i: number) => (blocks[i]!.end - blocks[i]!.start + 1440) % 1440
    expect(dur(0)).toBe(45)  // morning (stated default)
    expect(dur(1)).toBe(398) // high: floor(885 * 0.45)
    expect(dur(2)).toBe(309) // medium: floor(885 * 0.35)
    expect(dur(3)).toBe(178) // low: remainder
    expect(dur(4)).toBe(30)  // night
  })

  it('reserves the routine lengths the user stated', () => {
    const blocks = computeBlocksFromWakeSleep('07:00', '23:00', {
      morningRoutine: 90, nightRoutine: 60,
    })
    const dur = (i: number) => (blocks[i]!.end - blocks[i]!.start + 1440) % 1440
    expect(dur(0)).toBe(90)
    expect(dur(4)).toBe(60)
  })

  it('lets a routine be nothing at all', () => {
    const blocks = computeBlocksFromWakeSleep('07:00', '23:00', {
      morningRoutine: 0, nightRoutine: 0,
    })
    const dur = (i: number) => (blocks[i]!.end - blocks[i]!.start + 1440) % 1440
    expect(dur(0)).toBe(0)
    expect(dur(4)).toBe(0)
  })

  it('does not let routines outlast the day itself', () => {
    // Awake 07:00→09:00 = 120, but three hours of routines were stated.
    const blocks = computeBlocksFromWakeSleep('07:00', '09:00', {
      morningRoutine: 120, nightRoutine: 60,
    })
    const total = blocks.reduce(
      (sum, b) => sum + ((b.end - b.start + 1440) % 1440),
      0,
    )
    expect(total).toBeLessThanOrEqual(120)
  })

  it('no longer ties routine length to how long you are awake', () => {
    // The old 10%-of-awake rule made a later bedtime mean a longer shower.
    const early = computeBlocksFromWakeSleep('07:00', '21:00')
    const late = computeBlocksFromWakeSleep('07:00', '23:59')
    const morning = (b: DayBlocks) => (b[0]!.end - b[0]!.start + 1440) % 1440
    expect(morning(early)).toBe(morning(late))
  })
})

// ── applyBlockDurationChange (with demand-first collapsed blocks) ─────────────
//
// Capacity-aware sizing legitimately produces 0-minute work blocks, which sit
// below BLOCK_MIN_MINUTES. Growing an earlier block must skip them (nothing to
// take), not "take" negative minutes — which used to grow the empty blocks and
// inflate the delta cascaded into sleep.

describe('applyBlockDurationChange with collapsed blocks', () => {
  const collapsed: BlockDurations = {
    morningRoutine: 60, highPriority: 120, mediumPriority: 0, lowPriority: 0, nightRoutine: 60,
  }
  const SLEEP = 480

  it('growing a block skips empty blocks and takes from the next non-empty one', () => {
    const r = applyBlockDurationChange(collapsed, 'highPriority', 150, SLEEP)
    expect(r).not.toBeNull()
    expect(r!.durations.mediumPriority).toBe(0) // untouched, not inflated to 15
    expect(r!.durations.lowPriority).toBe(0)
    expect(r!.durations.nightRoutine).toBe(30)  // 60 - 30 taken (floor 15 respected)
    expect(r!.sleepMinutes).toBe(SLEEP)         // covered without touching sleep
  })

  it('growing past the available slack eats exactly the shortfall from sleep', () => {
    // +80: night can give 45 (60→15); the remaining 35 comes from sleep.
    const r = applyBlockDurationChange(collapsed, 'highPriority', 200, SLEEP)
    expect(r).not.toBeNull()
    expect(r!.durations.mediumPriority).toBe(0)
    expect(r!.durations.lowPriority).toBe(0)
    expect(r!.durations.nightRoutine).toBe(15)
    expect(r!.sleepMinutes).toBe(SLEEP - 35)
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

// ── computeSleepWindow ───────────────────────────────────────────────────────

describe('computeSleepWindow', () => {
  // Wake 07:00, bedtime 23:00. FLOORS ends the day at 15:00 — the shape of an
  // ordinary demand-first day, where the plan finishes long before bedtime.
  const shortDay = computeBlocksFromDurations('07:00', FLOORS)

  it('anchors the night on the bedtime the user set, not the end of the plan', () => {
    const win = computeSleepWindow(shortDay, '07:00', '23:00')!
    expect(win.startMin).toBe(23 * 60)
    expect(win.endMin).toBe(7 * 60)
    expect(win.durationMin).toBe(8 * 60)
  })

  it('reports the gap between the end of the plan and bedtime as open time', () => {
    const win = computeSleepWindow(shortDay, '07:00', '23:00')!
    // Day ends 15:00, bedtime 23:00 → 8h of open evening in between.
    expect(win.freeMinutes).toBe(8 * 60)
    expect(win.lostMinutes).toBe(0)
    expect(win.overran).toBe(false)
  })

  it('pushes bedtime later — and charges it to sleep — when the plan overruns', () => {
    const longDay = computeBlocksFromDurations('07:00', {
      morningRoutine: 60, highPriority: 480, mediumPriority: 240, lowPriority: 180, nightRoutine: 60,
    })
    // 07:00 + 1020 min of blocks → the day ends at midnight, an hour past target.
    const win = computeSleepWindow(longDay, '07:00', '23:00')!
    expect(win.startMin).toBe(0)
    expect(win.durationMin).toBe(7 * 60)
    expect(win.overran).toBe(true)
    expect(win.lostMinutes).toBe(60)
    expect(win.freeMinutes).toBe(0)
  })

  it('never claims more than the schedule allows, whatever the plan', () => {
    const win = computeSleepWindow(shortDay, '07:00', '01:00')!
    expect(win.durationMin).toBe(6 * 60)
  })

  it('falls back to the block-derived start when there is no bedtime', () => {
    const win = computeSleepWindow(shortDay, '07:00', null)!
    expect(win.startMin).toBe(15 * 60)
  })

  it('does not let the wind-down buffer alone count as an overrun', () => {
    // A plan that lands exactly on the target bedtime is tight, not over.
    const exactDay = computeBlocksFromDurations('07:00', {
      morningRoutine: 90, highPriority: 480, mediumPriority: 180, lowPriority: 120, nightRoutine: 90,
    })
    const win = computeSleepWindow(exactDay, '07:00', '23:00')!
    expect(win.startMin).toBe(23 * 60)
    expect(win.durationMin).toBe(8 * 60)
    expect(win.overran).toBe(false)
    expect(win.freeMinutes).toBe(0) // under the buffer → flagged as no wind-down
  })

  it('keeps an early-finishing afternoon out of the sleep window', () => {
    const win = computeSleepWindow(shortDay, '07:00', '23:00')!
    // 16:00 used to read as "asleep" because the last block ended at 15:00.
    expect(isSleepTime(960, undefined, shortDay, win.startMin)).toBe(false)
    expect(isSleepTime(23 * 60 + 30, undefined, shortDay, win.startMin)).toBe(true)
  })
})

// ── bedtime ↔ night length ───────────────────────────────────────────────────

describe('sleepMinutesFromTarget / sleepTargetFromMinutes', () => {
  it('measures the night backwards from wake, across midnight', () => {
    expect(sleepMinutesFromTarget('07:00', '23:00')).toBe(8 * 60)
    expect(sleepMinutesFromTarget('06:30', '22:45')).toBe(7 * 60 + 45)
    expect(sleepMinutesFromTarget('07:00', '01:00')).toBe(6 * 60)
  })

  it('round-trips: a night length maps back to the bedtime that produced it', () => {
    for (const [wake, target] of [['07:00', '23:00'], ['05:15', '21:30'], ['09:00', '02:00']]) {
      expect(sleepTargetFromMinutes(wake!, sleepMinutesFromTarget(wake!, target!))).toBe(target)
    }
  })

  it('does not push bedtime forward from wake (the old sign error)', () => {
    // 8h of sleep before a 07:00 wake is a 23:00 bedtime, never 15:00.
    expect(sleepTargetFromMinutes('07:00', 8 * 60)).toBe('23:00')
  })
})
