import { describe, it, expect } from 'vitest'
import { buildChime, type ChimeKind } from './chimes'

const ALL: ChimeKind[] = ['taskTicked', 'taskComplete', 'blockComplete', 'dayComplete']

/** Total wall-clock length of a chime, last note's end. */
function lengthSec(kind: ChimeKind): number {
  return Math.max(...buildChime(kind, () => 0.5).map((n) => n.startOffsetSec + n.durationSec))
}

describe('buildChime', () => {
  it('rises in pitch, always — a falling run reads as an error', () => {
    for (const kind of ALL) {
      const notes = buildChime(kind, () => 0.5)
      const freqs = notes.map((n) => n.freqHz)
      expect(freqs, kind).toEqual([...freqs].sort((a, b) => a - b))
      expect(notes.length, kind).toBeGreaterThan(1)
    }
  })

  it('plays its notes in order, without gaps in the sequence', () => {
    for (const kind of ALL) {
      const offsets = buildChime(kind, () => 0.5).map((n) => n.startOffsetSec)
      expect(offsets, kind).toEqual([...offsets].sort((a, b) => a - b))
      expect(offsets[0], kind).toBe(0)
    }
  })

  it('keeps the tick short — it fires dozens of times a day', () => {
    expect(lengthSec('taskTicked')).toBeLessThanOrEqual(0.25)
  })

  it('spends length only on the rare events', () => {
    // Everything else is a second or so: long enough to identify, short enough
    // not to intrude. Nothing gets to run on past that.
    for (const kind of ALL) {
      expect(lengthSec(kind), kind).toBeLessThanOrEqual(1.3)
    }
    expect(lengthSec('dayComplete')).toBeGreaterThan(lengthSec('taskTicked'))
  })

  it('scales with the size of the achievement', () => {
    // A tick is the smallest event, so it is the quietest and the shortest;
    // if it matched the milestones, the milestones would be worth nothing.
    const peak = (kind: ChimeKind) => Math.max(...buildChime(kind, () => 0.5).map((n) => n.peakGain))
    expect(peak('taskTicked')).toBeLessThan(peak('blockComplete'))
    expect(peak('taskTicked')).toBeLessThan(peak('dayComplete'))
    expect(buildChime('taskTicked', () => 0.5).length).toBeLessThan(
      buildChime('taskComplete', () => 0.5).length,
    )
  })

  it('never opens at full gain, which would click', () => {
    for (const kind of ALL) {
      for (const note of buildChime(kind, () => 0.5)) {
        expect(note.peakGain, kind).toBeGreaterThan(0)
        expect(note.peakGain, kind).toBeLessThanOrEqual(0.25)
        expect(note.durationSec, kind).toBeGreaterThan(0)
      }
    }
  })

  it('detunes the tick a little so it does not go stale', () => {
    const low = buildChime('taskTicked', () => 0)[0]!.freqHz
    const high = buildChime('taskTicked', () => 1)[0]!.freqHz
    expect(high).toBeGreaterThan(low)
    // ±12 cents either side: audible as variation, never as a wrong note.
    expect(high / low).toBeLessThan(Math.pow(2, 24 / 1200) + 1e-9)
  })

  it('varies only the tick, never the milestones', () => {
    for (const kind of ['taskComplete', 'blockComplete', 'dayComplete'] as ChimeKind[]) {
      expect(buildChime(kind, () => 0), kind).toEqual(buildChime(kind, () => 1))
    }
  })
})
