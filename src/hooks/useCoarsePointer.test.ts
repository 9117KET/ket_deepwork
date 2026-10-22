import { afterEach, describe, expect, it, vi } from 'vitest'
import { COARSE_POINTER_QUERY, coarsePointerQuery, readCoarse } from './useCoarsePointer'

describe('readCoarse', () => {
  it('is true only when the query matches', () => {
    expect(readCoarse({ matches: true })).toBe(true)
    expect(readCoarse({ matches: false })).toBe(false)
  })

  it('is false without a query list', () => {
    expect(readCoarse(null)).toBe(false)
    expect(readCoarse(undefined)).toBe(false)
  })
})

describe('coarsePointerQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is null where there is no window (server render, node)', () => {
    expect(typeof window).toBe('undefined')
    expect(coarsePointerQuery()).toBeNull()
    expect(readCoarse(coarsePointerQuery())).toBe(false)
  })

  it('is null when the window has no matchMedia', () => {
    vi.stubGlobal('window', {})
    expect(coarsePointerQuery()).toBeNull()
  })

  it('asks matchMedia for the coarse-pointer query', () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query === COARSE_POINTER_QUERY }))
    vi.stubGlobal('window', { matchMedia })
    expect(readCoarse(coarsePointerQuery())).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)')
  })

  it('reports a fine pointer as not coarse', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    expect(readCoarse(coarsePointerQuery())).toBe(false)
  })
})
