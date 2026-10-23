import { describe, expect, test } from 'vitest'
import { activeDonts, dontsToRows, resolveDontTexts, rowsToDontPayload, rowsToTexts, textsToRows } from './challengeCommitments'

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
  test('texts round-trip through rows', () => {
    expect(rowsToTexts(textsToRows(['A', ' ', ' B ']))).toEqual(['A', 'B'])
  })
})
