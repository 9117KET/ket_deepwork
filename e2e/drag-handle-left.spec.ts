/**
 * e2e/drag-handle-left.spec.ts
 *
 * The drag handle is the first thing in every task row, at its left edge,
 * before the checkbox (run 2026-11-11, spec 04). On a desktop it always was;
 * on a phone it trailed after the ⋮ until the user asked for the left side.
 *
 * Positions are read from bounding boxes, so a test names the row and the
 * pixels that broke it. Touches go through CDP (`Input.dispatchTouchEvent`),
 * Chromium's real input pipeline, as in touch-reorder.spec.ts.
 */

import { expect, test, type Locator, type Page } from '@playwright/test'
import { PHONE } from './helpers/mobile'

type Seed = Record<string, unknown>

const TOP3: Seed[] = [
  { id: 'T1', title: 'Tone', sectionId: 'mustDo', durationMinutes: 60 },
  { id: 'T2', title: 'Ttwo', sectionId: 'mustDo' },
  { id: 'T3', title: 'Tthree', sectionId: 'mustDo' },
]
const LIST: Seed[] = [
  { id: 'L1', title: 'Lone', sectionId: 'highPriority', durationMinutes: 60 },
  { id: 'P1', title: 'Parent', sectionId: 'highPriority' },
  { id: 'S1', title: 'Subone', sectionId: 'highPriority', parentId: 'P1' },
]
/** Enough rows that the page scrolls on a phone. */
const FILLER: Seed[] = Array.from({ length: 14 }, (_, i) => ({
  id: `F${i}`,
  title: `Filler ${i + 1}`,
  sectionId: 'highPriority',
}))

/** Rows to measure: a Tasks row, a Top 3 row, a subtask row. */
const ROWS = [
  { id: 'L1', title: 'Lone' },
  { id: 'T1', title: 'Tone' },
  { id: 'S1', title: 'Subone' },
]

function seed(page: Page, tasks: Seed[]) {
  return page.addInitScript((tasks) => {
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    window.sessionStorage.setItem('deepblock_guest_session', '1')
    window.localStorage.setItem('deepblock_tour_done', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
    window.sessionStorage.setItem(`shutdown_reminder_shown_${iso}`, '1')
    window.localStorage.setItem(
      'deepblock_state_v1',
      JSON.stringify({
        version: 1,
        state: {
          days: {
            [iso]: {
              date: iso,
              tasks: (tasks as Seed[]).map((t) => ({ isDone: false, ...t, date: iso })),
              habitCompletions: {},
              deepWorkSessions: [],
            },
          },
        },
      }),
    )
  }, tasks)
}

async function open(page: Page) {
  await page.goto('/')
  await expect(page.locator('[data-tour="date-nav"]')).toBeVisible({ timeout: 40_000 })
  // Not by text: a timed task is also an <option> in the timer's "Working on".
  await expect(page.locator('[data-task-id="L1"], [data-drag-handle][aria-label="Drag to move Lone"]').first()).toBeVisible()
}

async function rootsOf(page: Page, sectionId: string) {
  return page.evaluate((sectionId) => {
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const tasks = (JSON.parse(window.localStorage.getItem('deepblock_state_v1') ?? '{}').state?.days?.[iso]?.tasks ??
      []) as { id: string; sectionId: string; parentId?: string }[]
    return tasks.filter((t) => t.sectionId === sectionId && !t.parentId).map((t) => t.id)
  }, sectionId)
}

const row = (page: Page, id: string) => page.locator(`[data-task-id="${id}"]`).first()
const handleOf = (page: Page, title: string) =>
  page.getByRole('button', { name: `Drag to move ${title}`, exact: true })

async function box(loc: Locator) {
  const b = await loc.boundingBox()
  if (!b) throw new Error('not visible')
  return b
}

/** The handle sits left of the checkbox and left of the title, in one row. */
async function expectHandleFirst(page: Page, id: string, title: string) {
  const handle = handleOf(page, title)
  // The handle's parent is the row's one line on both anatomies (desktop rows
  // carry no data-task-id).
  const line = handle.locator('xpath=..')
  const h = await box(handle)
  const checkbox = await box(line.locator('input[type="checkbox"]').first())
  // Substring: a Top 3 phone title carries its rank ("1 Tone").
  const titleBox = await box(line.getByText(title).first())
  const label = `${id}: handle x=${Math.round(h.x)}..${Math.round(h.x + h.width)}, checkbox x=${Math.round(checkbox.x)}, title x=${Math.round(titleBox.x)}`
  expect(h.x + h.width, label).toBeLessThanOrEqual(checkbox.x + 1)
  expect(h.x, label).toBeLessThan(titleBox.x)
  return { handle: h, checkbox, title: titleBox }
}

async function flick(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(from.x + ((to.x - from.x) * i) / steps)
    const y = Math.round(from.y + ((to.y - from.y) * i) / steps)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(400)
}

test.describe('drag handle on the left: phone 390x844', () => {
  test.use(PHONE)

  test('a Tasks row, a Top 3 row and a subtask row lead with the handle', async ({ page }) => {
    await seed(page, [...TOP3, ...LIST])
    await open(page)
    for (const { id, title } of ROWS) {
      await handleOf(page, title).scrollIntoViewIfNeeded()
      const { handle } = await expectHandleFirst(page, id, title)
      // Still a thumb-sized target.
      expect(handle.width).toBeGreaterThanOrEqual(44)
      expect(handle.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('the row stays one line: handle, checkbox, title, chip, ⋮', async ({ page }) => {
    await seed(page, [...TOP3, ...LIST])
    await open(page)
    for (const { id, title } of ROWS) {
      const r = row(page, id)
      const { handle, checkbox, title: t } = await expectHandleFirst(page, id, title)
      const menu = await box(r.getByRole('button', { name: 'Task options' }).first())
      expect(menu.x, `${id}: ⋮ after the title`).toBeGreaterThan(t.x)
      // One line: every control shares the handle's vertical band.
      const mid = handle.y + handle.height / 2
      for (const [name, b] of [['checkbox', checkbox], ['⋮', menu]] as const) {
        expect(Math.abs(b.y + b.height / 2 - mid), `${id}: ${name} off the handle's line`).toBeLessThanOrEqual(2)
      }
    }
  })

  test('the progress bar lines up with the title', async ({ page }) => {
    await seed(page, [...TOP3, ...LIST])
    await open(page)
    for (const id of ['T1', 'L1']) {
      const offset = await row(page, id).evaluate((el) => {
        const line = el.querySelector(':scope > div.flex') as HTMLElement
        const titleButton = line.querySelector('button[aria-haspopup="dialog"]') as HTMLElement
        // The progress block is the line's next sibling; its content starts
        // past its left padding.
        let bar = line.nextElementSibling as HTMLElement | null
        while (bar && bar.hasAttribute('data-drop-line')) bar = bar.nextElementSibling as HTMLElement | null
        if (!bar) return null
        const contentLeft = bar.getBoundingClientRect().left + parseFloat(getComputedStyle(bar).paddingLeft)
        return contentLeft - titleButton.getBoundingClientRect().left
      })
      expect(offset, `${id}: progress bar vs title`).not.toBeNull()
      expect(Math.abs(offset!), `${id}: progress bar is ${offset}px off the title`).toBeLessThanOrEqual(1)
    }
  })

  test('a Top 3 row with no handle keeps its title in the same column', async ({ page }) => {
    // All three done: the card collapses, and its rows offer Remove, not drag.
    await seed(page, [...TOP3.map((t) => ({ ...t, isDone: true })), ...LIST])
    await open(page)
    await page.getByRole('button', { name: /Top Three Priorities complete/ }).click()
    await expect(handleOf(page, 'Tone')).toHaveCount(0)
    const inset = async (id: string) => {
      const r = await box(row(page, id))
      const c = await box(row(page, id).locator('input[type="checkbox"]').first())
      return Math.round(c.x - r.x)
    }
    // Same inset as a row that does show the handle.
    expect(await inset('T1')).toBe(await inset('L1'))
  })

  test('a swipe on the row body scrolls; one from the checkbox lifts nothing', async ({ page }) => {
    await seed(page, [...TOP3, ...LIST, ...FILLER])
    await open(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    const titleBox = await box(row(page, 'L1').getByText('Lone', { exact: true }))
    const start = { x: Math.round(titleBox.x + titleBox.width / 2), y: Math.round(titleBox.y + titleBox.height / 2) }
    await flick(page, start, { x: start.x, y: start.y - 160 })
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(40)
    expect(await rootsOf(page, 'highPriority')).toEqual(['L1', 'P1', ...FILLER.map((f) => f.id)])

    // From the checkbox, downwards over the next rows: no lift, no move.
    await page.evaluate(() => window.scrollTo(0, 0))
    await row(page, 'T1').scrollIntoViewIfNeeded()
    const cb = await box(row(page, 'T1').locator('input[type="checkbox"]').first())
    const from = { x: Math.round(cb.x + cb.width / 2), y: Math.round(cb.y + cb.height / 2) }
    await flick(page, from, { x: from.x, y: from.y + 120 })
    await expect(page.locator('[data-drop-line]')).toHaveCount(0)
    expect(await rootsOf(page, 'mustDo')).toEqual(['T1', 'T2', 'T3'])
  })
})

test.describe('drag handle on the left: Fold cover 280px', () => {
  test.use({ ...PHONE, viewport: { width: 280, height: 653 } })

  test('nothing overflows and every row still leads with its handle', async ({ page }) => {
    await seed(page, [...TOP3, ...LIST])
    await open(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    for (const { id, title } of ROWS) {
      await row(page, id).scrollIntoViewIfNeeded()
      await expectHandleFirst(page, id, title)
      const r = await box(row(page, id))
      expect(r.x + r.width, `${id} past the right edge`).toBeLessThanOrEqual(280)
    }
  })
})

test.describe('drag handle on the left: desktop 1280x900', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false })

  test('a Tasks row, a Top 3 row and a subtask row lead with the handle', async ({ page }) => {
    await seed(page, [...TOP3, ...LIST])
    await open(page)
    await page.mouse.move(1270, 890)
    for (const { id, title } of ROWS) await expectHandleFirst(page, id, title)
  })
})
