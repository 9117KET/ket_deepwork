/**
 * e2e/calendar-timezone.spec.ts
 *
 * Unit-level coverage for the Google Calendar date/timezone helpers
 * (`convex/_shared/calendarTime.ts`). These are pure functions (Intl + Date),
 * so they run in the Playwright/Node runner without a browser.
 *
 * They guard the import "wrong day" bug: the fetch window must cover the user's
 * LOCAL days, and event placement must use the user's zone — across positive,
 * negative, half-hour, and DST-shifting timezones.
 */

import { test, expect } from '@playwright/test'
import {
  toLocalIsoDay,
  hhmmFromDate,
  tzOffsetMs,
  zonedWallTimeToUtc,
} from '../convex/_shared/calendarTime'

const HOUR = 3_600_000

test.describe('tzOffsetMs', () => {
  test('Europe/Berlin is +2h in summer (CEST), +1h in winter (CET)', () => {
    expect(tzOffsetMs(new Date('2026-06-14T12:00:00Z'), 'Europe/Berlin')).toBe(2 * HOUR)
    expect(tzOffsetMs(new Date('2026-01-14T12:00:00Z'), 'Europe/Berlin')).toBe(1 * HOUR)
  })

  test('negative and half-hour zones', () => {
    expect(tzOffsetMs(new Date('2026-06-14T12:00:00Z'), 'America/New_York')).toBe(-4 * HOUR) // EDT
    expect(tzOffsetMs(new Date('2026-01-14T12:00:00Z'), 'America/New_York')).toBe(-5 * HOUR) // EST
    expect(tzOffsetMs(new Date('2026-06-14T12:00:00Z'), 'Asia/Kolkata')).toBe(5.5 * HOUR)
    expect(tzOffsetMs(new Date('2026-06-14T12:00:00Z'), 'UTC')).toBe(0)
  })
})

test.describe('zonedWallTimeToUtc — fetch-window boundaries', () => {
  test('Berlin local day boundaries map to correct UTC instants (summer)', () => {
    expect(zonedWallTimeToUtc('2026-06-14', '00:00:00', 'Europe/Berlin').toISOString()).toBe(
      '2026-06-13T22:00:00.000Z',
    )
    expect(zonedWallTimeToUtc('2026-06-28', '23:59:59', 'Europe/Berlin').toISOString()).toBe(
      '2026-06-28T21:59:59.000Z',
    )
  })

  test('Berlin winter boundary is +1h (DST-aware)', () => {
    expect(zonedWallTimeToUtc('2026-01-10', '00:00:00', 'Europe/Berlin').toISOString()).toBe(
      '2026-01-09T23:00:00.000Z',
    )
  })

  test('negative zone pushes UTC forward', () => {
    expect(zonedWallTimeToUtc('2026-06-14', '00:00:00', 'America/New_York').toISOString()).toBe(
      '2026-06-14T04:00:00.000Z',
    )
  })

  test('UTC is identity', () => {
    expect(zonedWallTimeToUtc('2026-06-14', '00:00:00', 'UTC').toISOString()).toBe(
      '2026-06-14T00:00:00.000Z',
    )
  })

  test('round-trips back to the same local day', () => {
    for (const tz of ['Europe/Berlin', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland']) {
      const utc = zonedWallTimeToUtc('2026-06-14', '00:00:00', tz)
      expect(toLocalIsoDay(utc, tz)).toBe('2026-06-14')
    }
  })
})

test.describe('toLocalIsoDay / hhmmFromDate — event placement', () => {
  test('an evening Berlin event stays on its local day (the bug regression)', () => {
    // 23:30 on Jun 14 in Berlin == 21:30Z. Naive UTC handling would call this
    // Jun 14 21:30 (still 14th) — but a 00:30 event would roll to the prev day
    // under UTC. Verify the zone keeps it on the right local day + time.
    const ev = new Date('2026-06-14T23:30:00+02:00')
    expect(toLocalIsoDay(ev, 'Europe/Berlin')).toBe('2026-06-14')
    expect(hhmmFromDate(ev, 'Europe/Berlin')).toBe('23:30')
  })

  test('a post-midnight Berlin event is NOT rolled to the previous day', () => {
    const ev = new Date('2026-06-15T00:30:00+02:00') // 22:30Z on the 14th
    expect(toLocalIsoDay(ev, 'Europe/Berlin')).toBe('2026-06-15')
    expect(hhmmFromDate(ev, 'Europe/Berlin')).toBe('00:30')
  })

  test('same instant, different zones, different local day/time', () => {
    const instant = new Date('2026-06-15T03:00:00Z')
    expect(toLocalIsoDay(instant, 'Europe/Berlin')).toBe('2026-06-15') // 05:00 CEST
    expect(hhmmFromDate(instant, 'Europe/Berlin')).toBe('05:00')
    expect(toLocalIsoDay(instant, 'America/New_York')).toBe('2026-06-14') // 23:00 EDT prev day
    expect(hhmmFromDate(instant, 'America/New_York')).toBe('23:00')
  })

  test('Google "Z" dateTime and offset dateTime resolve identically', () => {
    const z = new Date('2026-06-15T07:00:00Z')
    const off = new Date('2026-06-15T09:00:00+02:00')
    expect(toLocalIsoDay(z, 'Europe/Berlin')).toBe(toLocalIsoDay(off, 'Europe/Berlin'))
    expect(hhmmFromDate(z, 'Europe/Berlin')).toBe(hhmmFromDate(off, 'Europe/Berlin'))
    expect(hhmmFromDate(z, 'Europe/Berlin')).toBe('09:00')
  })
})
