import { describe, expect, test } from 'vitest'
import { activeDonts, commitDraft, dontsToRows, resolveDontTexts, rowsToDontPayload, rowsToTexts, textsToRows, withDraft } from './challengeCommitments'

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
