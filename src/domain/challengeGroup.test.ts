import { describe, expect, it } from 'vitest'
import {
  LEGACY_PARTNER_KEY,
  SEASON_STATE_LABEL,
  audienceNoun,
  countedDates,
  dayOf,
  deleteAudience,
  groupCountLabel,
  isClosedDate,
  leaveSentence,
  memberDates,
  memberToDates,
  othersOf,
  othersWho,
  reopenDateBounds,
  reopenEndDateError,
  reopenNeedsEndDate,
  rowsOf,
  seasonCellState,
  seatsLeftLabel,
  successorName,
} from './challengeGroup'
import { memberSeason } from './challenge'
import { warningSentence } from './challengeList'

const member = (name: string, key: string | undefined, joinedAt: number, timezone = 'UTC') => ({ displayName: name, key, joinedAt, timezone })

describe('othersOf', () => {
  it('reads `others` in the order the server sends (join order)', () => {
    const others = [member('Ana', 'k1', 1), member('Ben', 'k2', 2), member('Cy', 'k3', 3)]
    expect(othersOf({ partner: others[0]!, others }).map((m) => m.key)).toEqual(['k1', 'k2', 'k3'])
  })

  it('falls back to the single partner when the server sends no `others`', () => {
    const got = othersOf({ partner: member('Ana', undefined, 1) })
    expect(got).toHaveLength(1)
    expect(got[0]!.key).toBe(LEGACY_PARTNER_KEY)
    expect(got[0]!.displayName).toBe('Ana')
  })

  it('is empty with nobody else', () => {
    expect(othersOf({ partner: null })).toEqual([])
    expect(othersOf({ partner: null, others: [] })).toEqual([])
  })
})

describe('per-member dates', () => {
  it('gives each member their own date from their own timezone', () => {
    const dateIn = (tz: string) => (tz === 'Pacific/Kiritimati' ? '2026-11-12' : '2026-11-11')
    const dates = memberDates(
      [
        { key: 'a', timezone: 'Europe/London' },
        { key: 'b', timezone: 'Pacific/Kiritimati' },
      ],
      dateIn,
    )
    expect(dates).toEqual([
      { key: 'a', date: '2026-11-11' },
      { key: 'b', date: '2026-11-12' },
    ])
    // History runs to each one's own yesterday: the member a day ahead leaves no hole.
    expect(memberToDates(dates)).toEqual([
      { key: 'a', toDate: '2026-11-10' },
      { key: 'b', toDate: '2026-11-11' },
    ])
  })

  it('reads a day and rows by key from `others`, or the partner for the first member on an older server', () => {
    const card = { partner: { n: 1 }, others: [{ key: 'a', day: { n: 1 } }, { key: 'b', day: null }] }
    expect(dayOf(card, 'a', true)).toEqual({ n: 1 })
    expect(dayOf(card, 'b', false)).toBeNull()
    expect(dayOf({ partner: { n: 9 } }, 'partner', true)).toEqual({ n: 9 })
    expect(dayOf({ partner: { n: 9 } }, 'x', false)).toBeNull()
    expect(dayOf(null, 'a', true)).toBeNull()
    const history = { partner: [{ n: 1 }], others: [{ key: 'a', rows: [{ n: 1 }] }, { key: 'b', rows: [{ n: 2 }] }] }
    expect(rowsOf(history, 'b', false)).toEqual([{ n: 2 }])
    expect(rowsOf({ partner: [{ n: 3 }] }, 'partner', true)).toEqual([{ n: 3 }])
    expect(rowsOf({ partner: [{ n: 3 }] }, 'x', false)).toEqual([])
  })
})

describe('counts for a group', () => {
  it('counts the others who locked in, and the check-ins once there are any', () => {
    expect(groupCountLabel([{ planSetAt: 1 }, null, { planSetAt: 2 }, undefined, {}])).toBe('2 of 5 others locked in')
    expect(groupCountLabel([{ planSetAt: 1, checkinAt: 2 }, { planSetAt: 1 }, null])).toBe('2 of 3 others locked in, 1 checked in')
    // A check-in without a lock-in is a check-in, not a lock-in.
    expect(groupCountLabel([{ checkinAt: 2 }, null])).toBe('0 of 2 others locked in, 1 checked in')
  })

  it('keeps the partner mark for two people and counts for a group', () => {
    expect(othersWho({ solo: false, others: [{ name: 'Ana', day: { planSetAt: 1 } }] })).toBe('Ana ✓ plan locked')
    expect(othersWho({ solo: false, others: [{ name: 'Ana', day: { planSetAt: 1 } }, { name: 'Ben', day: null }] })).toBe('1 of 2 others locked in')
    expect(othersWho({ solo: true, others: [] })).toBe('Just you')
    expect(othersWho({ solo: false, others: [] })).toBe('Waiting for someone to join')
  })

  it('says "your partner" for one other member and "the others" for more', () => {
    expect(audienceNoun(1)).toBe('your partner')
    expect(audienceNoun(0)).toBe('your partner')
    expect(audienceNoun(2)).toBe('the others')
  })

  it('says how many seats are left, and nothing when full', () => {
    expect(seatsLeftLabel(2, 8)).toBe('6 seats left')
    expect(seatsLeftLabel(7, 8)).toBe('1 seat left')
    expect(seatsLeftLabel(8, 8)).toBeNull()
  })

  it('names who loses the season on delete', () => {
    expect(deleteAudience([])).toBe('you')
    expect(deleteAudience([{ displayName: 'Ana' }])).toBe('both you and Ana')
    expect(deleteAudience([{ displayName: 'Ana' }, { displayName: 'Ben' }])).toBe('everyone in it (3 people)')
  })
})

describe('leaveSentence', () => {
  it('alone: leaving ends it', () => {
    expect(leaveSentence({ isCreator: true, others: [] })).toBe('Leaving ends this challenge. Your days stay recorded.')
  })

  it('creator with others: the earliest joined becomes the creator and it goes on', () => {
    const others = [
      { displayName: 'Ben', joinedAt: 30 },
      { displayName: 'Ana', joinedAt: 20 },
    ]
    expect(successorName(others)).toBe('Ana')
    expect(leaveSentence({ isCreator: true, others })).toBe(
      'Ana becomes the creator and the challenge goes on. You can come back with a new invite link, and everything you recorded comes back with you.',
    )
  })

  it('anyone else: they can come back with everything', () => {
    expect(leaveSentence({ isCreator: false, others: [{ displayName: 'Ana', joinedAt: 1 }] })).toBe(
      'You can come back with a new invite link, and everything you recorded comes back with you.',
    )
  })

  it('never says "both" any more', () => {
    const s = leaveSentence({ isCreator: true, others: [{ displayName: 'Ana', joinedAt: 1 }] })
    expect(s).not.toMatch(/both/i)
  })
})

describe('closed stretches in the grid', () => {
  const spans = [{ from: '2026-11-03', to: '2026-11-05' }]

  it('a closed day reads "closed" for everybody, never missed', () => {
    expect(isClosedDate('2026-11-04', spans)).toBe(true)
    expect(isClosedDate('2026-11-06', spans)).toBe(false)
    expect(seasonCellState(undefined, '2026-11-04', '2026-11-11', spans)).toBe('closed')
    expect(seasonCellState(undefined, '2026-11-06', '2026-11-11', spans)).toBe('none')
    expect(SEASON_STATE_LABEL.closed).toBe('closed')
  })

  it('a day someone did act on keeps what they did', () => {
    expect(seasonCellState({ date: '2026-11-03', planSetAt: 1, checkinAt: 2 }, '2026-11-03', '2026-11-11', spans)).toBe('both')
  })

  it('without spans nothing changes', () => {
    expect(seasonCellState(undefined, '2026-11-04', '2026-11-11', [])).toBe('none')
    expect(seasonCellState(undefined, '2026-11-12', '2026-11-11', undefined)).toBe('future')
  })

  it('closed days count for nobody: not in the days reached, not breaking a run', () => {
    const dates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
    const counted = countedDates(dates, spans)
    expect(counted).toEqual(['2026-11-01', '2026-11-02', '2026-11-06', '2026-11-07'])
    const full = (date: string) => ({ date, planSetAt: 1, checkinAt: 2 })
    const rows = [full('2026-11-01'), full('2026-11-02'), full('2026-11-06'), full('2026-11-07')]
    const season = memberSeason(rows, counted, '2026-11-07')
    expect(season).toMatchObject({ fullDays: 4, pastDays: 4, streak: 4 })
  })
})

describe('reopen dates', () => {
  it('bounds run from the latest member today to 366 days from mine, inclusive', () => {
    expect(reopenDateBounds({ myDate: '2026-11-11', memberTodays: ['2026-11-11', '2026-11-12'] })).toEqual({ min: '2026-11-12', max: '2027-11-11' })
    expect(reopenDateBounds({ myDate: '2026-11-11', memberTodays: [] })).toEqual({ min: '2026-11-11', max: '2027-11-11' })
  })

  it('needs a new end date once it is before anyone’s today', () => {
    expect(reopenNeedsEndDate({ endDate: '2026-12-31', myDate: '2026-11-11', memberTodays: [] })).toBe(false)
    expect(reopenNeedsEndDate({ endDate: '2026-11-11', myDate: '2026-11-11', memberTodays: [] })).toBe(false)
    expect(reopenNeedsEndDate({ endDate: '2026-11-10', myDate: '2026-11-11', memberTodays: [] })).toBe(true)
    // A member already on the 12th: the 11th would end it again for them at once.
    expect(reopenNeedsEndDate({ endDate: '2026-11-11', myDate: '2026-11-11', memberTodays: ['2026-11-12'] })).toBe(true)
  })

  it('checks a typed end date the way the server does', () => {
    const base = { myDate: '2026-11-11', memberTodays: [], startDate: '2026-10-01' }
    expect(reopenEndDateError({ ...base, endDate: '' })).toBe('Pick an end date.')
    expect(reopenEndDateError({ ...base, endDate: '2026-11-10' })).toBe('Pick an end date from today on.')
    expect(reopenEndDateError({ ...base, endDate: '2027-11-11' })).toBeNull()
    expect(reopenEndDateError({ ...base, endDate: '2027-11-12' })).toBe('A season runs at most 366 days from today.')
    expect(reopenEndDateError({ ...base, endDate: '2026-11-11' })).toBeNull()
  })
})

describe('warningSentence for a group', () => {
  const warning = { forMe: false, missedSince: '2026-11-07', issuedAt: 1, memberKey: 'k2', displayName: 'Ben' }

  it('names the warned member from the warning, and says they drop out in a group', () => {
    expect(warningSentence(warning, 'Ana', '2026-11-11', 4)).toBe(
      'No lock-in or check-in from Ben for 4 days. Ben drops out tomorrow unless they lock in or check in.',
    )
    expect(warningSentence({ ...warning, forMe: true }, 'Ana', '2026-11-11', 3)).toBe(
      'No lock-in or check-in from you for 4 days. You drop out tomorrow unless you lock in or check in today.',
    )
  })

  it('keeps the two-person sentence for two', () => {
    expect(warningSentence(warning, 'Ana', '2026-11-11', 2)).toBe('No lock-in or check-in from Ben for 4 days. It closes tomorrow unless Ben locks in or checks in.')
  })
})
