import { describe, expect, test } from 'vitest'
import {
  activeCommitments,
  activeDonts,
  commitDraft,
  commitmentsToRows,
  dontsToRows,
  goalItemsOf,
  keptLine,
  normalizeGoals,
  resolveCommitmentTexts,
  resolveDontTexts,
  rowsToCommitmentPayload,
  rowsToDontPayload,
  rowsToTexts,
  textsToRows,
  withDraft,
} from './challengeCommitments'

describe('keptLine', () => {
  const goals = [
    { id: 'a', text: 'Read' },
    { id: 'b', text: 'Run' },
    { id: 'z', text: 'Old', archivedAt: 1 },
  ]
  test('counts over the active goals plus archived goals kept that day', () => {
    // b was not kept, so this is 2 of 3, never "2 of 2" (which would read as all kept).
    expect(keptLine(['a', 'z'], goals)).toBe('Kept 2 of 3 goals')
    expect(keptLine(['a', 'b'], goals)).toBe('Kept 2 of 2 goals')
    expect(keptLine([], goals)).toBe('Kept 0 of 2 goals')
    expect(keptLine(['b', 'b'], goals)).toBe('Kept 1 of 2 goals')
  })
  test('never reads more kept than goals counted', () => {
    // One active goal and one archived goal, both kept: 2 of 2, not "2 of 1".
    expect(keptLine(['a', 'z'], [goals[0]!, goals[2]!])).toBe('Kept 2 of 2 goals')
    expect(keptLine(['z'], [goals[0]!, goals[2]!])).toBe('Kept 1 of 2 goals')
  })
  test('ignores ids nobody knows and says "goal" for one', () => {
    expect(keptLine(['nope', 'a'], [goals[0]!])).toBe('Kept 1 of 1 goal')
  })
  test('is null with no active goals', () => {
    expect(keptLine(['z'], [goals[2]!])).toBeNull()
    expect(keptLine([], [])).toBeNull()
  })
})

describe('goals with ids', () => {
  test('normalizeGoals gives legacy strings the server’s legacy ids', () => {
    expect(normalizeGoals(['Read', { id: 'g1', text: 'Run' }])).toEqual([
      { id: 'goal-legacy-0', text: 'Read' },
      { id: 'g1', text: 'Run' },
    ])
    expect(normalizeGoals(undefined)).toEqual([])
  })
  test('goalItemsOf prefers goalItems and falls back to the texts', () => {
    const items = [{ id: 'g1', text: 'Read', archivedAt: 5 }]
    expect(goalItemsOf({ goals: [], goalItems: items })).toEqual(items)
    expect(goalItemsOf({ goals: ['Read'] })).toEqual([{ id: 'goal-legacy-0', text: 'Read' }])
    expect(goalItemsOf(null)).toEqual([])
  })
  test('active, resolve and rows work for goals as for don’ts', () => {
    const items = [
      { id: 'g1', text: 'Read' },
      { id: 'g2', text: 'Old', archivedAt: 1 },
    ]
    expect(activeCommitments(items).map((g) => g.id)).toEqual(['g1'])
    expect(activeCommitments(undefined)).toEqual([])
    expect(resolveCommitmentTexts(['g2', 'x'], items, 'a goal')).toEqual(['Old', 'a goal'])
    expect(commitmentsToRows(items)).toEqual([{ id: 'g1', text: 'Read' }])
    expect(rowsToCommitmentPayload([{ id: 'g1', text: ' Read more ' }, { text: 'New' }, { id: 'g3', text: '  ' }])).toEqual([
      { id: 'g1', text: 'Read more' },
      { text: 'New' },
    ])
  })
})

const list = [
  { id: 'd1', text: 'No doomscrolling' },
  { id: 'd2', text: 'No alcohol', archivedAt: 1 },
  { id: 'd3', text: 'No snooze' },
]

describe('activeDonts', () => {
  test('drops archived ones and keeps order', () => {
    expect(activeDonts(list).map((d) => d.id)).toEqual(['d1', 'd3'])
    expect(activeDonts([])).toEqual([])
  })
})

describe('resolveDontTexts', () => {
  test('resolves archived ids too, in the order given', () => {
    expect(resolveDontTexts(['d3', 'd2'], list)).toEqual(['No snooze', 'No alcohol'])
  })
  test('an unknown id reads as "a don’t"', () => {
    expect(resolveDontTexts(['gone'], list)).toEqual(['a don’t'])
    expect(resolveDontTexts([], list)).toEqual([])
  })
})

describe('rows', () => {
  test('dontsToRows offers the active ones with their ids', () => {
    expect(dontsToRows(list)).toEqual([
      { id: 'd1', text: 'No doomscrolling' },
      { id: 'd3', text: 'No snooze' },
    ])
  })
  test('rowsToDontPayload keeps ids, trims, drops blanks, leaves new rows without an id', () => {
    expect(
      rowsToDontPayload([
        { id: 'd1', text: ' No doomscrolling after 22:00 ' },
        { id: 'd3', text: '   ' },
        { text: 'No sugar' },
        { text: '' },
      ]),
    ).toEqual([{ id: 'd1', text: 'No doomscrolling after 22:00' }, { text: 'No sugar' }])
  })
  test('commitDraft appends a trimmed draft; blank or full is a no-op', () => {
    const rows = [{ id: 'd1', text: 'A' }]
    expect(commitDraft(rows, '  B ', 10)).toEqual([{ id: 'd1', text: 'A' }, { text: 'B' }])
    expect(commitDraft(rows, '   ', 10)).toBeNull()
    expect(commitDraft(rows, 'B', 1)).toBeNull()
  })
  test('blur then Add commits the draft once', () => {
    // The ListEditor sequence: blur commits and clears the draft, then the Add click sees ''.
    let items: { id?: string; text: string }[] = []
    let draft = 'No sugar'
    for (let i = 0; i < 2; i++) {
      const next = commitDraft(items, draft, 10)
      if (next) {
        items = next
        draft = ''
      }
    }
    expect(items).toEqual([{ text: 'No sugar' }])
  })
  test('withDraft folds a pending draft into what is sent', () => {
    expect(withDraft([{ text: 'A' }], ' B ')).toEqual([{ text: 'A' }, { text: 'B' }])
    expect(withDraft([{ text: 'A' }], '')).toEqual([{ text: 'A' }])
    const full = Array.from({ length: 10 }, (_, i) => ({ text: `${i}` }))
    expect(withDraft(full, 'extra')).toHaveLength(10)
  })
  test('texts round-trip through rows', () => {
    expect(rowsToTexts(textsToRows(['A', ' ', ' B ']))).toEqual(['A', 'B'])
  })
})
