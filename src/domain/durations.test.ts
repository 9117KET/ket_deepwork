import { describe, expect, it } from 'vitest'
import { durationOptions, extractTrailingDuration, parseDurationInput } from './durations'

describe('parseDurationInput', () => {
  it('reads every documented form', () => {
    const inputs = ['2h', '2 h', '2hr', '2 hours', '30m', '30 min', '2h30', '2h 30m', '1.5h', '1,5h', '1:30', '45', '2', '1.5', '0.5']
    expect(inputs.map(parseDurationInput)).toEqual([120, 120, 120, 120, 30, 30, 150, 150, 90, 90, 90, 45, 120, 90, 30])
  })

  it('reads the longer spellings and ignores case and spaces', () => {
    expect(parseDurationInput('30 minutes')).toBe(30)
    expect(parseDurationInput('  2H 30M ')).toBe(150)
    expect(parseDurationInput('1h30')).toBe(90)
    expect(parseDurationInput('24h')).toBe(1440)
    expect(parseDurationInput('10')).toBe(10)
    expect(parseDurationInput('9')).toBe(540)
  })

  it('rejects what says nothing usable', () => {
    expect(['', 'abc', '0', '25h', '-5m'].map(parseDurationInput)).toEqual([null, null, null, null, null])
    expect(parseDurationInput('0m')).toBeNull()
    expect(parseDurationInput('2x')).toBeNull()
    expect(parseDurationInput('1:75')).toBeNull()
    expect(parseDurationInput('1441')).toBeNull()
  })

  it('round-trips the chip text (formatMinutes)', () => {
    expect(parseDurationInput('1h30')).toBe(90)
    expect(parseDurationInput('45m')).toBe(45)
    expect(parseDurationInput('3h')).toBe(180)
  })
})

describe('extractTrailingDuration', () => {
  it('takes a trailing length off the title', () => {
    expect(extractTrailingDuration('Write report 2h')).toEqual({ title: 'Write report', minutes: 120 })
    expect(extractTrailingDuration('Plan 1:30')).toEqual({ title: 'Plan', minutes: 90 })
    expect(extractTrailingDuration('Write report 2h 30m')).toEqual({ title: 'Write report', minutes: 150 })
    expect(extractTrailingDuration('Read 45m')).toEqual({ title: 'Read', minutes: 45 })
    expect(extractTrailingDuration('Read 2 hours')).toEqual({ title: 'Read', minutes: 120 })
    expect(extractTrailingDuration('Chapter 3 1.5h')).toEqual({ title: 'Chapter 3', minutes: 90 })
  })

  it('leaves a title without a trailing length alone', () => {
    expect(extractTrailingDuration('Call 911')).toBeNull()
    expect(extractTrailingDuration('2h')).toBeNull()
    expect(extractTrailingDuration('Write report')).toBeNull()
    expect(extractTrailingDuration('2h with Sam')).toBeNull()
    expect(extractTrailingDuration('Fix bug2h')).toBeNull()
    expect(extractTrailingDuration('Standup 10:30')).toBeNull()
    expect(extractTrailingDuration('Marathon 30h')).toBeNull()
  })
})

describe('durationOptions', () => {
  it('keeps an off-ladder typed value in order', () => {
    expect(durationOptions(100)).toEqual([10, 15, 20, 30, 45, 60, 90, 100, 120, 180, 240, 300, 360, 420, 480])
  })
})
