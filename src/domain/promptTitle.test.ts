import { describe, expect, it } from 'vitest'
import { titleFromPrompt } from './promptTitle'

describe('titleFromPrompt: what a title prompt adds', () => {
  it('adds nothing when the prompt is cancelled', () => {
    expect(titleFromPrompt(null)).toBeNull()
  })

  it('adds nothing for an empty or whitespace title', () => {
    expect(titleFromPrompt('')).toBeNull()
    expect(titleFromPrompt('   ')).toBeNull()
    expect(titleFromPrompt('\t\n')).toBeNull()
  })

  it('adds a typed title, trimmed', () => {
    expect(titleFromPrompt('Write the report')).toBe('Write the report')
    expect(titleFromPrompt('  Call the bank  ')).toBe('Call the bank')
  })

  it('adds the prefilled title when it is accepted as is', () => {
    expect(titleFromPrompt('New task')).toBe('New task')
  })
})
