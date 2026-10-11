import { describe, expect, test } from "vitest"
import { busyFromEvents, findFreeSlot, sessionEventId, SLOT_STEP_MS } from "./freeSlot"

const MIN = 60_000
const H = 60 * MIN
// 09:00 on an arbitrary day, already on the 15-minute grid.
const NINE = Date.UTC(2026, 9, 12, 9, 0)

describe("findFreeSlot", () => {
  test("an empty window starts at the beginning", () => {
    expect(findFreeSlot({ busy: [], from: NINE, to: NINE + 8 * H, durationMs: H })).toBe(NINE)
  })

  test("rounds an off-grid start up to the next quarter hour", () => {
    expect(findFreeSlot({ busy: [], from: NINE + 7 * MIN, to: NINE + 8 * H, durationMs: H })).toBe(
      NINE + 15 * MIN,
    )
  })

  test("skips past a meeting that overlaps the start", () => {
    const busy = [{ start: NINE - 30 * MIN, end: NINE + 50 * MIN }]
    expect(findFreeSlot({ busy, from: NINE, to: NINE + 8 * H, durationMs: H })).toBe(NINE + H)
  })

  test("uses a gap only when the whole task fits in it", () => {
    const busy = [
      { start: NINE + 30 * MIN, end: NINE + H }, // 30m gap before: too short for 45m
      { start: NINE + 2 * H, end: NINE + 3 * H }, // 1h gap after the first: fits
    ]
    expect(findFreeSlot({ busy, from: NINE, to: NINE + 8 * H, durationMs: 45 * MIN })).toBe(NINE + H)
  })

  test("merges overlapping and unsorted busy blocks from several calendars", () => {
    const busy = [
      { start: NINE + H, end: NINE + 2 * H },
      { start: NINE, end: NINE + 90 * MIN },
      { start: NINE + 2 * H, end: NINE + 150 * MIN },
    ]
    expect(findFreeSlot({ busy, from: NINE, to: NINE + 8 * H, durationMs: 30 * MIN })).toBe(
      NINE + 150 * MIN,
    )
  })

  test("returns null when nothing fits before the window closes", () => {
    const busy = [{ start: NINE, end: NINE + 7 * H + 30 * MIN }]
    expect(findFreeSlot({ busy, from: NINE, to: NINE + 8 * H, durationMs: H })).toBeNull()
  })

  test("a task may end exactly when the window closes", () => {
    expect(findFreeSlot({ busy: [], from: NINE, to: NINE + H, durationMs: H })).toBe(NINE)
  })

  test("ignores zero-length busy entries", () => {
    const busy = [{ start: NINE, end: NINE }]
    expect(findFreeSlot({ busy, from: NINE, to: NINE + H, durationMs: H })).toBe(NINE)
  })

  test("the grid is fifteen minutes", () => {
    expect(SLOT_STEP_MS).toBe(15 * MIN)
  })
})

describe("sessionEventId", () => {
  test("only uses characters Google accepts in an event id", () => {
    const id = sessionEventId("session-1716400000000-Xy_Z")
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/)
  })

  test("is stable, and distinct for distinct sessions", () => {
    expect(sessionEventId("abc")).toBe(sessionEventId("abc"))
    expect(sessionEventId("abc")).not.toBe(sessionEventId("abd"))
  })
})

describe("busyFromEvents", () => {
  const timed = (start: string, end: string, extra = {}) => ({
    start: { dateTime: start },
    end: { dateTime: end },
    ...extra,
  })

  test("counts timed events as busy", () => {
    expect(busyFromEvents([timed("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z")])).toEqual([
      { start: Date.parse("2026-10-12T08:00:00Z"), end: Date.parse("2026-10-12T09:00:00Z") },
    ])
  })

  test("all-day events never block the day", () => {
    expect(busyFromEvents([{ start: { date: "2026-10-12" }, end: { date: "2026-10-13" } }])).toEqual([])
  })

  test("events marked free, cancelled or declined do not block time", () => {
    expect(
      busyFromEvents([
        timed("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", { transparency: "transparent" }),
        timed("2026-10-12T10:00:00Z", "2026-10-12T11:00:00Z", { status: "cancelled" }),
        timed("2026-10-12T12:00:00Z", "2026-10-12T13:00:00Z", {
          attendees: [{ self: true, responseStatus: "declined" }],
        }),
      ]),
    ).toEqual([])
  })

  test("an event someone else declined still blocks your time", () => {
    const ev = timed("2026-10-12T12:00:00Z", "2026-10-12T13:00:00Z", {
      attendees: [{ responseStatus: "declined" }, { self: true, responseStatus: "accepted" }],
    })
    expect(busyFromEvents([ev])).toHaveLength(1)
  })
})

describe("busyFromEvents: multi-day spans", () => {
  test("a timed event lasting a day or more does not block time", () => {
    const span = {
      start: { dateTime: "2026-10-04T22:30:00+02:00" },
      end: { dateTime: "2026-10-16T23:00:00+02:00" },
    }
    expect(busyFromEvents([span])).toEqual([])
  })

  test("a long but same-day event still blocks", () => {
    const workshop = {
      start: { dateTime: "2026-10-12T08:00:00+02:00" },
      end: { dateTime: "2026-10-12T20:00:00+02:00" },
    }
    expect(busyFromEvents([workshop])).toHaveLength(1)
  })
})
