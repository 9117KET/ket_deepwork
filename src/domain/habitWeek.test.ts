import { describe, expect, it } from 'vitest'
import { computeHabitWeek, countHabitWeekDone } from './habitWeek'

/** Build a days record from a map of ISO date -> whether habit "h" was kept. */
function days(map: Record<string, boolean>) {
  const out: Record<string, { habitCompletions: Record<string, boolean> }> = {}
  for (const [iso, done] of Object.entries(map)) {
    out[iso] = { habitCompletions: { h: done } }
  }
  return out
}

describe('computeHabitWeek', () => {
  it('returns seven days, oldest first, ending on the given day', () => {
    const week = computeHabitWeek({}, 'h', '2026-09-07')
    expect(week).toHaveLength(7)
    expect(week[0]!.iso).toBe('2026-09-01')
    expect(week[6]!.iso).toBe('2026-09-07')
  })

  it('marks a kept day done', () => {
    const week = computeHabitWeek(days({ '2026-09-07': true }), 'h', '2026-09-07')
    expect(week[6]!.state).toBe('done')
  })

  it('marks a missed day after a kept day as broke — never miss twice', () => {
    const week = computeHabitWeek(
      days({ '2026-09-05': true, '2026-09-06': false }),
      'h',
      '2026-09-07',
    )
    expect(week[5]!.state).toBe('broke')
  })

  it('marks a missed day after another missed day as plain missed', () => {
    const week = computeHabitWeek(
      days({ '2026-09-05': false, '2026-09-06': false }),
      'h',
      '2026-09-07',
    )
    expect(week[5]!.state).toBe('missed')
  })

  it('never marks today as broke — the day is not over', () => {
    const week = computeHabitWeek(days({ '2026-09-06': true }), 'h', '2026-09-07')
    expect(week[6]!.state).toBe('missed')
  })

  it('treats a habit never recorded as missed throughout', () => {
    const week = computeHabitWeek({}, 'h', '2026-09-07')
    expect(week.every((d) => d.state === 'missed')).toBe(true)
  })

  it('does not read another habit’s completions', () => {
    const week = computeHabitWeek(
      { '2026-09-07': { habitCompletions: { other: true } } },
      'h',
      '2026-09-07',
    )
    expect(week[6]!.state).toBe('missed')
  })

  it('only counts an explicit true as done', () => {
    const week = computeHabitWeek(
      { '2026-09-07': { habitCompletions: { h: undefined as unknown as boolean } } },
      'h',
      '2026-09-07',
    )
    expect(week[6]!.state).toBe('missed')
  })

  it('crosses a month boundary correctly', () => {
    const week = computeHabitWeek({}, 'h', '2026-09-02')
    expect(week[0]!.iso).toBe('2026-08-27')
  })

  it('honours a custom length', () => {
    expect(computeHabitWeek({}, 'h', '2026-09-07', 3)).toHaveLength(3)
  })
})

describe('countHabitWeekDone', () => {
  it('counts only the kept days', () => {
    const week = computeHabitWeek(
      days({ '2026-09-05': true, '2026-09-07': true }),
      'h',
      '2026-09-07',
    )
    expect(countHabitWeekDone(week)).toBe(2)
  })

  it('is zero for an untouched habit', () => {
    expect(countHabitWeekDone(computeHabitWeek({}, 'h', '2026-09-07'))).toBe(0)
  })
})
