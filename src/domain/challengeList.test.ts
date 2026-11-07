import { describe, expect, it } from 'vitest'
import {
  challengePillLabel,
  dayStage,
  endedSentence,
  headlinePhrase,
  owedAct,
  partnerWho,
  seasonDatesError,
  seasonDeadlinesError,
  seasonStepError,
  sortChallenges,
  stateMark,
  warningSentence,
  type ChallengeListItem,
} from './challengeList'

const base: ChallengeListItem = {
  status: 'active',
  createdAt: 1,
  endDate: '2026-12-31',
  endedReason: null,
  endedAt: null,
  isCreator: true,
  warning: null,
}
const entry = (name: string, over: Partial<ChallengeListItem>) => ({ name, challenge: { ...base, ...over } })

// 3 Nov 2026, noon UTC: the same calendar day in every locale's timezone used by CI.
const NOV3 = Date.UTC(2026, 10, 3, 12)

describe('partnerWho', () => {
  it('says "Just you" on a solo challenge with nobody in it', () => {
    expect(partnerWho({ solo: true, partnerName: null, partnerDay: null })).toBe('Just you')
  })

  it('keeps "Waiting for a partner" on a two-person challenge still alone', () => {
    expect(partnerWho({ solo: false, partnerName: null, partnerDay: null })).toBe('Waiting for a partner')
  })

  it('shows the partner and their mark once someone has joined, solo or not', () => {
    expect(partnerWho({ solo: false, partnerName: 'Sam', partnerDay: { planSetAt: 1 } })).toBe('Sam ✓ plan locked')
    expect(partnerWho({ solo: true, partnerName: 'Sam', partnerDay: null })).toBe('Sam – nothing yet')
  })
})

describe('headlinePhrase', () => {
  it('joins the number and its label', () => {
    expect(headlinePhrase({ number: '70', label: 'days left' })).toBe('70 days left')
    expect(headlinePhrase({ number: '1', label: 'day left' })).toBe('1 day left')
  })

  it('is the label alone when there is no number', () => {
    expect(headlinePhrase({ number: null, label: 'Last day' })).toBe('Last day')
  })
})

describe('sortChallenges', () => {
  it('puts active first, newest first within each group', () => {
    const sorted = sortChallenges([
      entry('old ended', { status: 'ended', createdAt: 1 }),
      entry('old active', { createdAt: 2 }),
      entry('new ended', { status: 'ended', createdAt: 5 }),
      entry('new active', { createdAt: 4 }),
    ])
    expect(sorted.map((e) => e.name)).toEqual(['new active', 'old active', 'new ended', 'old ended'])
  })

  it('does not mutate its input', () => {
    const input = [entry('a', { createdAt: 1 }), entry('b', { createdAt: 2 })]
    sortChallenges(input)
    expect(input.map((e) => e.name)).toEqual(['a', 'b'])
  })
})

describe('row state marks', () => {
  it('reads a day row as nothing, locked or checked in', () => {
    expect(dayStage(null)).toBe('none')
    expect(dayStage({ planSetAt: null, checkinAt: null })).toBe('none')
    expect(dayStage({ planSetAt: 5 })).toBe('locked')
    expect(dayStage({ planSetAt: 5, checkinAt: 9 })).toBe('checkedIn')
    // A check-in without a plan still counts as checked in.
    expect(dayStage({ checkinAt: 9 })).toBe('checkedIn')
  })

  it('pairs every glyph with a label', () => {
    expect(stateMark(undefined)).toEqual({ glyph: '–', label: 'nothing yet', done: false })
    expect(stateMark({ planSetAt: 1 })).toEqual({ glyph: '✓', label: 'plan locked', done: true })
    expect(stateMark({ planSetAt: 1, checkinAt: 2 })).toEqual({ glyph: '✓', label: 'checked in', done: true })
  })

  it('owes the lock-in first, then the check-in, then nothing', () => {
    expect(owedAct(null)).toBe('lock')
    expect(owedAct({ checkinAt: 3 })).toBe('lock')
    expect(owedAct({ planSetAt: 1 })).toBe('checkin')
    expect(owedAct({ planSetAt: 1, checkinAt: 2 })).toBe('none')
  })
})

describe('endedSentence', () => {
  const ended = (over: Partial<ChallengeListItem>) => ({ ...base, status: 'ended' as const, endedAt: NOV3, ...over })

  it('names who left when the creator left', () => {
    expect(endedSentence(ended({ endedReason: 'creatorLeft', isCreator: false }), 'Kin', 'en-GB')).toBe('Ended 3 Nov · Kin left')
    expect(endedSentence(ended({ endedReason: 'creatorLeft', isCreator: true }), 'Sam', 'en-GB')).toBe('Ended 3 Nov · you left')
  })

  it('says why an inactive season closed', () => {
    expect(endedSentence(ended({ endedReason: 'inactive' }), 'Sam', 'en-GB')).toBe(
      'Closed 3 Nov after 4 days without a lock-in or check-in',
    )
  })

  it('covers the season running out, a manual end, everyone leaving and old rows', () => {
    expect(endedSentence(ended({ endedReason: 'seasonOver' }), 'Sam', 'en-GB')).toBe('Season over')
    expect(endedSentence(ended({ endedReason: 'manual' }), 'Sam', 'en-GB')).toBe('Ended by hand')
    expect(endedSentence(ended({ endedReason: 'allLeft' }), null, 'en-GB')).toBe('Ended 3 Nov · everyone left')
    expect(endedSentence(ended({ endedReason: null, endedAt: null }), 'Sam', 'en-GB')).toBe('Season over')
  })
})

describe('warningSentence', () => {
  it('names the partner and what keeps it open', () => {
    expect(warningSentence({ forMe: false, missedSince: '2026-10-30', issuedAt: 0 }, 'Sam', '2026-11-02')).toBe(
      'No lock-in or check-in from Sam for 3 days. It closes tomorrow unless Sam locks in or checks in.',
    )
  })

  it('speaks to me when I am the one warned', () => {
    expect(warningSentence({ forMe: true, missedSince: '2026-10-30', issuedAt: 0 }, 'Sam', '2026-11-02')).toBe(
      'No lock-in or check-in from you for 3 days. It closes tomorrow unless you lock in or check in today.',
    )
  })

  it('never says fewer than three days', () => {
    expect(warningSentence({ forMe: false, missedSince: '2026-11-01', issuedAt: 0 }, null, '2026-11-02')).toContain('for 3 days')
  })
})

describe('challengePillLabel', () => {
  const p = (dayNumber: number, totalDays: number, phase: 'upcoming' | 'active' | 'ended' = 'active') => ({
    dayNumber,
    totalDays,
    daysLeft: totalDays - dayNumber,
    phase,
  })

  it('shows the day count with one running challenge', () => {
    expect(challengePillLabel([p(22, 92)])).toBe('Day 22/92 · 70 left')
  })

  it('shows the number of challenges with more than one', () => {
    expect(challengePillLabel([p(22, 92), p(3, 30)])).toBe('2 challenges')
    expect(challengePillLabel([p(22, 92), p(3, 30), p(1, 365)])).toBe('3 challenges')
  })

  it('counts only challenges whose span holds today', () => {
    expect(challengePillLabel([])).toBeUndefined()
    expect(challengePillLabel([p(1, 30, 'upcoming')])).toBeUndefined()
    expect(challengePillLabel([p(22, 92), p(1, 30, 'upcoming')])).toBe('Day 22/92 · 70 left')
  })
})

describe('seasonStepError', () => {
  const ok = { startDate: '2026-11-02', endDate: '2027-01-31', planDeadline: '10:00', checkinDeadline: '23:59' }

  it('passes a valid season', () => {
    expect(seasonStepError(ok)).toBeNull()
  })

  it('refuses an end before the start, and a span over 366 days, on the end date', () => {
    expect(seasonStepError({ ...ok, endDate: '2026-11-01' })?.field).toBe('end')
    expect(seasonStepError({ ...ok, endDate: '2027-11-02' })).toBeNull() // 366 days inclusive
    expect(seasonStepError({ ...ok, endDate: '2027-11-03' })).toMatchObject({ field: 'end', message: expect.stringContaining('366') })
  })

  it('refuses a plan deadline at or after 21:30', () => {
    expect(seasonStepError({ ...ok, planDeadline: '21:29' })).toBeNull()
    expect(seasonStepError({ ...ok, planDeadline: '21:30' })?.field).toBe('plan')
    expect(seasonStepError({ ...ok, planDeadline: '22:00' })?.field).toBe('plan')
  })

  it('refuses a check-in deadline at or before 21:30', () => {
    expect(seasonStepError({ ...ok, checkinDeadline: '21:31' })).toBeNull()
    expect(seasonStepError({ ...ok, checkinDeadline: '21:30' })?.field).toBe('checkin')
    expect(seasonStepError({ ...ok, checkinDeadline: '20:00' })?.field).toBe('checkin')
    expect(seasonStepError({ ...ok, checkinDeadline: '' })?.field).toBe('checkin')
  })
})

describe('seasonDatesError and seasonDeadlinesError', () => {
  it('checks the dates alone: format, order, at most a year', () => {
    expect(seasonDatesError({ startDate: '2026-11-02', endDate: '2026-11-02' })).toBeNull()
    expect(seasonDatesError({ startDate: '', endDate: '2026-11-02' })?.field).toBe('start')
    expect(seasonDatesError({ startDate: '2026-11', endDate: '' })?.field).toBe('start')
    expect(seasonDatesError({ startDate: '2026-11-02', endDate: '' })?.field).toBe('end')
    expect(seasonDatesError({ startDate: '2026-11-02', endDate: '02/11/2026' })?.field).toBe('end')
    // The create form has no start error slot, so seasonStepError shows it under Ends.
    expect(seasonStepError({ startDate: '', endDate: '2026-11-02', planDeadline: '10:00', checkinDeadline: '23:59' })?.field).toBe('end')
    expect(seasonDatesError({ startDate: '2026-11-02', endDate: '2026-11-01' })?.message).toContain('on or after')
    expect(seasonDatesError({ startDate: '2026-11-02', endDate: '2027-11-03' })?.message).toContain('366')
  })

  it('checks the deadlines alone', () => {
    expect(seasonDeadlinesError({ planDeadline: '10:00', checkinDeadline: '23:59' })).toBeNull()
    expect(seasonDeadlinesError({ planDeadline: '21:30', checkinDeadline: '23:59' })?.field).toBe('plan')
    expect(seasonDeadlinesError({ planDeadline: '10:00', checkinDeadline: '21:30' })?.field).toBe('checkin')
  })

  it('seasonStepError is the two in order, dates first', () => {
    const bad = { startDate: '2026-11-02', endDate: '2026-11-01', planDeadline: '22:00', checkinDeadline: '20:00' }
    expect(seasonStepError(bad)?.field).toBe('end')
    expect(seasonStepError({ ...bad, endDate: '2026-11-03' })?.field).toBe('plan')
  })
})
