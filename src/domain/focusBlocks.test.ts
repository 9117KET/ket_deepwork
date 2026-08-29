import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FOCUS_BLOCK_MINUTES,
  FOCUS_BLOCK_PRESETS,
  MAX_PLANNED_BLOCKS,
  blockPlanOptions,
  blocksForMinutes,
  formatBlockCount,
  normalizeFocusBlockMinutes,
  suggestedBreakMinutes,
} from './focusBlocks'

describe('normalizeFocusBlockMinutes', () => {
  it('falls back to the default for missing or nonsense values', () => {
    expect(normalizeFocusBlockMinutes(undefined)).toBe(DEFAULT_FOCUS_BLOCK_MINUTES)
    expect(normalizeFocusBlockMinutes(null)).toBe(DEFAULT_FOCUS_BLOCK_MINUTES)
    expect(normalizeFocusBlockMinutes(Number.NaN)).toBe(DEFAULT_FOCUS_BLOCK_MINUTES)
  })

  it('clamps to the supported range', () => {
    expect(normalizeFocusBlockMinutes(1)).toBe(10)
    expect(normalizeFocusBlockMinutes(500)).toBe(120)
  })

  it('keeps a custom length inside the range', () => {
    expect(normalizeFocusBlockMinutes(52)).toBe(52)
  })
})

describe('suggestedBreakMinutes', () => {
  it('uses the preset break where one exists', () => {
    for (const preset of FOCUS_BLOCK_PRESETS) {
      expect(suggestedBreakMinutes(preset.minutes)).toBe(preset.breakMinutes)
    }
  })

  it('derives ~20% rounded to five minutes for a custom length', () => {
    expect(suggestedBreakMinutes(52)).toBe(10)
    expect(suggestedBreakMinutes(120)).toBe(25)
  })

  it('never suggests less than five minutes', () => {
    expect(suggestedBreakMinutes(10)).toBe(5)
  })
})

describe('blockPlanOptions', () => {
  it('offers one through the maximum, in minutes', () => {
    const options = blockPlanOptions(45)
    expect(options).toHaveLength(MAX_PLANNED_BLOCKS)
    expect(options[0]).toEqual({ blocks: 1, minutes: 45 })
    expect(options[3]).toEqual({ blocks: 4, minutes: 180 })
  })
})

describe('blocksForMinutes', () => {
  it('rounds up, because a part-block still needs a sitting', () => {
    expect(blocksForMinutes(90, 45)).toBe(2)
    expect(blocksForMinutes(95, 45)).toBe(3)
    expect(blocksForMinutes(0, 45)).toBe(0)
  })
})

describe('formatBlockCount', () => {
  it('singularises one', () => {
    expect(formatBlockCount(1)).toBe('1 block')
    expect(formatBlockCount(3)).toBe('3 blocks')
  })
})
