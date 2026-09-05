/**
 * audio/chimes.ts
 *
 * The four sounds the planner makes, and the one AudioContext they share.
 *
 * They are one family on purpose. Ticking a task, finishing its last block,
 * finishing a focus block, and clearing the Top Three are the same motif at
 * four sizes: an ascending consonant run, because a rising contour is what
 * reads as success and a falling one reads as an error. Size carries the
 * meaning — if a tick and a finished day sound alike, the finished day is worth
 * nothing.
 *
 * Every one of these fires in response to something the user did (a tick, a
 * countdown they started). None of them is an unsolicited interruption, which
 * is why there is no "not during a focus block" guard here — the block's own
 * chime is the block ending.
 *
 * On habituation: the tick is detuned a few cents each time so it does not go
 * stale, but whether it plays is never random. Intermittent reinforcement works
 * and that is exactly the problem — it belongs in a slot machine, not in a tool
 * someone depends on daily. A confirmation sound is allowed to become familiar;
 * that is what confirmation is for. Novelty is spent only on the once-a-day
 * event that can still surprise you.
 */

export type ChimeKind = 'taskTicked' | 'taskComplete' | 'blockComplete' | 'dayComplete'

export interface ChimeNote {
  freqHz: number
  /** Seconds after the chime starts. */
  startOffsetSec: number
  durationSec: number
  peakGain: number
  type: OscillatorType
}

/** C5 major triad plus the octave — the shape every chime here is cut from. */
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const D6 = 1174.66

/**
 * Attack time. A gain that jumps straight to peak clicks; a few milliseconds of
 * ramp is the difference between a chime and a pop.
 */
const ATTACK_SEC = 0.008

/** Detune range for the tick, in cents. Small enough to read as the same sound. */
const TICK_DETUNE_CENTS = 12

function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200)
}

/**
 * The notes for one chime.
 *
 * Pure, and takes its own randomness, so the shape of every sound is testable
 * without a browser or an audio device.
 */
export function buildChime(kind: ChimeKind, random: () => number = Math.random): ChimeNote[] {
  switch (kind) {
    /**
     * A tick is the smallest event that gets a sound, so it gets the smallest
     * sound: two notes, a rising fifth, under a quarter second. Short alerts
     * distract less, and this is the one that fires dozens of times a day.
     */
    case 'taskTicked': {
      const detune = centsToRatio((random() * 2 - 1) * TICK_DETUNE_CENTS)
      return [
        { freqHz: G5 * detune, startOffsetSec: 0,    durationSec: 0.09, peakGain: 0.07, type: 'sine' },
        { freqHz: D6 * detune, startOffsetSec: 0.07, durationSec: 0.14, peakGain: 0.08, type: 'sine' },
      ]
    }

    /** A finished focus block: the original arpeggio, quieter than it was. */
    case 'blockComplete':
      return [C5, E5, G5].map((freqHz, i) => ({
        freqHz,
        startOffsetSec: i * 0.18,
        durationSec: 0.6,
        peakGain: 0.18,
        type: 'sine' as OscillatorType,
      }))

    /** The last block of a task: the same run, carried up to the octave. */
    case 'taskComplete':
      return [C5, E5, G5, C6].map((freqHz, i) => ({
        freqHz,
        startOffsetSec: i * 0.15,
        durationSec: 0.6,
        peakGain: 0.18,
        type: 'sine' as OscillatorType,
      }))

    /**
     * All three priorities done. This happens at most once a day, so it is the
     * only one allowed to be long, and the only one with its own timbre.
     */
    case 'dayComplete':
      return [C5, E5, G5, C6].map((freqHz, i) => ({
        freqHz,
        startOffsetSec: i * 0.16,
        durationSec: 0.75,
        peakGain: 0.2,
        type: 'triangle' as OscillatorType,
      }))
  }
}

// ── Sound preference ─────────────────────────────────────────────────────────

const SOUND_KEY = 'deepblock_sound_v1'

/**
 * Per-device, not per-account: whether you want the laptop to chime says
 * nothing about whether the phone should. So this lives in localStorage and is
 * deliberately left out of the synced AppState.
 */
export function isSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true // storage blocked (private mode) — sound on is the default
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
  } catch {
    // preference lasts this session only
  }
}

// ── Playback ─────────────────────────────────────────────────────────────────

/**
 * One context for the whole app. Constructing a fresh AudioContext per chime
 * leaks them — browsers cap how many can exist at once (Chrome around six), so
 * a session with enough finished blocks goes silent with no error.
 */
let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    return ctx
  } catch {
    return null
  }
}

/**
 * Play one chime. Silent — never throwing — when sound is off, when the tab is
 * in the background, or when the device has no usable audio.
 *
 * iOS only unlocks an AudioContext after a real user gesture, so a chime fired
 * from a timer callback stays quiet until something has been tapped. That is a
 * platform rule, not something to work around.
 */
export function playChime(kind: ChimeKind): void {
  try {
    if (!isSoundEnabled()) return
    if (typeof document !== 'undefined' && document.hidden) return
    const audio = getContext()
    if (!audio) return

    void audio.resume().then(() => {
      const start = audio.currentTime
      for (const note of buildChime(kind)) {
        const osc = audio.createOscillator()
        const gain = audio.createGain()
        osc.connect(gain)
        gain.connect(audio.destination)
        osc.type = note.type
        osc.frequency.value = note.freqHz

        const t = start + note.startOffsetSec
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(note.peakGain, t + ATTACK_SEC)
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.durationSec)
        osc.start(t)
        osc.stop(t + note.durationSec)
      }
    })
  } catch {
    // No audio available — the visual feedback carries it on its own.
  }
}
