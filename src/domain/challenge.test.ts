import { describe, expect, it } from 'vitest'
import type { DayState, Task } from './types'
import {
  bothLockedDays,
  buildChallengeSummary,
  buildShareText,
  challengeDates,
  challengeProgress,
  dayCellState,
  extractInviteToken,
  formatDeepMinutes,
  jointStreak,
} from './challenge'

const span = { startDate: '2026-10-01', endDate: '2026-12-31' }

function task(over: Partial<Task> & { id: string }): Task {
  return { title: over.id, sectionId: 'highPriority', date: '2026-10-22', isDone: false, ...over }
}

function makeDay(over: Partial<DayState> = {}): DayState {
  return { date: '2026-10-22', tasks: [], deepWorkSessions: [], ...over }
}

const habits = [
  { id: 'h1', label: 'Read' },
  { id: 'h2', label: 'Run' },
  { id: 'h3', label: 'Sleep by 11' },
]

describe('buildChallengeSummary', () => {
  it('titles the Top 3, counts the rest, and counts private tasks without titling them', () => {
    const day = makeDay({
      tasks: [
        task({ id: 'a', title: 'Write ch. 2', sectionId: 'mustDo', isDone: true }),
        task({ id: 'b', title: 'Secret', sectionId: 'mustDo', isPrivate: true }),
        task({ id: 'c', title: 'Call Ana', sectionId: 'mustDo' }),
        task({ id: 'd', title: 'Email', isDone: true }),
        task({ id: 'e', title: 'Therapy', isPrivate: true }),
        task({ id: 'f', title: 'Groceries' }),
        task({ id: 'g', title: 'sub of f', parentId: 'f', isDone: true }),
      ],
      habitCompletions: { h1: true, h2: false, h3: true },
    })
    const s = buildChallengeSummary(day, habits)
    expect(s.top3).toEqual([
      { title: 'Write ch. 2', isDone: true },
      { title: 'Call Ana', isDone: false },
    ])
    expect(s).toMatchObject({ tasksDone: 1, tasksTotal: 2, privateCount: 2, habitsDone: 2, habitsTotal: 3 })
    expect(JSON.stringify(s)).not.toContain('Secret')
    expect(JSON.stringify(s)).not.toContain('Therapy')
  })

  it('counts earned minutes only, never hand-logged ones', () => {
    const day = makeDay({
      deepWorkSessions: [
        { id: 's1', label: 'x', durationMinutes: 50, startedAt: '2026-10-22T09:00:00Z', finishedAt: '2026-10-22T09:50:00Z' },
        { id: 's2', label: 'y', durationMinutes: 90, startedAt: '2026-10-22T10:00:00Z', finishedAt: '2026-10-22T11:30:00Z', source: 'manual' },
        { id: 's3', label: 'z', durationMinutes: 25, startedAt: '2026-10-22T12:00:00Z' },
      ],
    })
    expect(buildChallengeSummary(day, []).deepWorkMinutes).toBe(50)
  })

  it('an absent day is an empty summary', () => {
    expect(buildChallengeSummary(undefined, habits)).toEqual({
      top3: [],
      tasksDone: 0,
      tasksTotal: 0,
      privateCount: 0,
      deepWorkMinutes: 0,
      habitsDone: 0,
      habitsTotal: 3,
    })
  })
})

describe('challengeProgress', () => {
  it('counts the day and what is left', () => {
    expect(challengeProgress(span, '2026-10-01')).toEqual({ dayNumber: 1, totalDays: 92, daysLeft: 91, phase: 'active' })
    expect(challengeProgress(span, '2026-10-22')).toEqual({ dayNumber: 22, totalDays: 92, daysLeft: 70, phase: 'active' })
    expect(challengeProgress(span, '2026-12-31')).toEqual({ dayNumber: 92, totalDays: 92, daysLeft: 0, phase: 'active' })
  })

  it('clamps outside the span', () => {
    expect(challengeProgress(span, '2026-09-20')).toEqual({ dayNumber: 1, totalDays: 92, daysLeft: 92, phase: 'upcoming' })
    expect(challengeProgress(span, '2027-01-05')).toEqual({ dayNumber: 92, totalDays: 92, daysLeft: 0, phase: 'ended' })
  })

  it('is unmoved by the DST change in the middle of the span', () => {
    const dates = challengeDates(span)
    expect(dates).toHaveLength(92)
    expect(dates[0]).toBe('2026-10-01')
    expect(dates[24]).toBe('2026-10-25')
    expect(dates[25]).toBe('2026-10-26')
    expect(dates[91]).toBe('2026-12-31')
  })
})

describe('dayCellState', () => {
  it('reads the stamps', () => {
    expect(dayCellState(undefined, '2026-10-30', '2026-10-22')).toBe('future')
    expect(dayCellState(undefined, '2026-10-20', '2026-10-22')).toBe('none')
    expect(dayCellState({ date: 'x', planSetAt: 1 }, '2026-10-20', '2026-10-22')).toBe('plan')
    expect(dayCellState({ date: 'x', checkinAt: 1 }, '2026-10-20', '2026-10-22')).toBe('checkin')
    expect(dayCellState({ date: 'x', planSetAt: 1, checkinAt: 2 }, '2026-10-22', '2026-10-22')).toBe('both')
  })
})

describe('buildShareText', () => {
  const progress = challengeProgress(span, '2026-10-22')
  const summary = {
    top3: [
      { title: 'Write ch. 2', isDone: true },
      { title: 'Review PR', isDone: false },
    ],
    tasksDone: 1,
    tasksTotal: 3,
    privateCount: 1,
    deepWorkMinutes: 135,
    habitsDone: 6,
    habitsTotal: 10,
  }

  it('the morning line', () => {
    expect(buildShareText({ kind: 'plan', displayName: 'Kin', progress, summary })).toBe(
      ['Plan locked — Day 22/92 (70 left)', 'Top 3: ✅ Write ch. 2 · ⬜ Review PR', '+3 more, 1 private', '— Kin'].join('\n'),
    )
  })

  it('the evening line carries the facts, the confession and the note', () => {
    expect(
      buildShareText({ kind: 'checkin', displayName: 'Kin', progress, summary, note: ' Rough start, good finish. ', dontsBroken: ['No phone in bed'] }),
    ).toBe(
      [
        'Checked in — Day 22/92 (70 left)',
        'Top 3: ✅ Write ch. 2 · ⬜ Review PR',
        '+1/3 more, 1 private',
        'Deep work 2h15 · Habits 6/10',
        'Broke: No phone in bed',
        'Rough start, good finish.',
        '— Kin',
      ].join('\n'),
    )
  })

  it('formatDeepMinutes', () => {
    expect(formatDeepMinutes(0)).toBe('0m')
    expect(formatDeepMinutes(45)).toBe('45m')
    expect(formatDeepMinutes(60)).toBe('1h')
    expect(formatDeepMinutes(135)).toBe('2h15')
  })
})

describe('extractInviteToken', () => {
  it('accepts a link, a bare token, and nothing else', () => {
    expect(extractInviteToken('https://ket-deepwork.vercel.app/challenge/join?invite=abc-123-def')).toBe('abc-123-def')
    expect(extractInviteToken('  4f1c2e0a-9b7d-4c3e-8f2a-1b2c3d4e5f60 ')).toBe('4f1c2e0a-9b7d-4c3e-8f2a-1b2c3d4e5f60')
    expect(extractInviteToken('https://example.com/?code=abc')).toBeNull()
    expect(extractInviteToken('hello world')).toBeNull()
    expect(extractInviteToken('')).toBeNull()
  })
})

describe('week tallies', () => {
  const both = (date: string) => ({ date, planSetAt: 1, checkinAt: 2 })
  const planOnly = (date: string) => ({ date, planSetAt: 1 })

  it('bothLockedDays counts days both members locked in', () => {
    const mine = [planOnly('2026-10-19'), both('2026-10-20'), both('2026-10-21')]
    const partner = [both('2026-10-20'), planOnly('2026-10-21'), planOnly('2026-10-22')]
    expect(bothLockedDays(mine, partner, ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'])).toBe(2)
  })

  it('jointStreak walks back from an unfinished today without breaking on it', () => {
    const mine = [both('2026-10-19'), both('2026-10-20'), both('2026-10-21'), planOnly('2026-10-22')]
    const partner = [both('2026-10-19'), both('2026-10-20'), both('2026-10-21'), both('2026-10-22')]
    expect(jointStreak(mine, partner, '2026-10-22', '2026-10-01')).toBe(3)
    expect(jointStreak(mine, partner, '2026-10-21', '2026-10-01')).toBe(3)
    expect(jointStreak(mine, [], '2026-10-22', '2026-10-01')).toBe(0)
    // A gap ends it.
    expect(jointStreak([...mine, both('2026-10-17')], [...partner, both('2026-10-17')], '2026-10-22', '2026-10-01')).toBe(3)
    // The span's first day is the floor.
    expect(jointStreak(mine, partner, '2026-10-22', '2026-10-21')).toBe(1)
  })
})
