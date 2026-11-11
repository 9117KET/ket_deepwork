/**
 * e2e/drag-handle.spec.ts
 *
 * The drag handle on every task row (run 2026-11-07, spec 01).
 *
 * People on the live app took Move up / Move down for the only way to move a
 * task: the grip was a faint 14px icon, hidden on narrow screens and absent
 * on phones, and a phone row lifted only after a 300 ms hold. Now every row
 * in the Top 3 and in Tasks shows a handle ("Drag to move <title>") at every
 * width; a finger on it lifts the row at once; and the Top 3 never holds more
 * than three, however a task is dropped there.
 *
 * Touches go through CDP (`Input.dispatchTouchEvent`), Chromium's real input
 * pipeline, as in touch-reorder.spec.ts.
 */

import { expect, test, type Locator, type Page } from '@playwright/test'
import { PHONE } from './helpers/mobile'

const TOP3 = [
  { id: 'T1', title: 'Tone', sectionId: 'mustDo' },
  { id: 'T2', title: 'Ttwo', sectionId: 'mustDo' },
  { id: 'T3', title: 'Tthree', sectionId: 'mustDo' },
]
const LIST = [
  { id: 'L1', title: 'Lone', sectionId: 'highPriority' },
  { id: 'L2', title: 'Ltwo', sectionId: 'highPriority' },
]
const ALL = [...TOP3, ...LIST]

function seed(page: Page, tasks: Array<Record<string, unknown>>) {
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
              tasks: (tasks as Array<Record<string, unknown>>).map((t) => ({ isDone: false, ...t, date: iso })),
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
  await expect(page.getByText('Lone', { exact: true })).toBeVisible()
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

const handle = (page: Page, title: string) => page.getByRole('button', { name: `Drag to move ${title}`, exact: true })

async function point(loc: Locator, yFraction = 0.5, xFraction = 0.5) {
  const box = await loc.boundingBox()
  if (!box) throw new Error('not visible')
  return { x: Math.round(box.x + box.width * xFraction), y: Math.round(box.y + box.height * yFraction) }
}

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(to.x, to.y, { steps: 2 })
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await page.waitForTimeout(300)
}

/**
 * A finger down, a quick move, and up: no hold anywhere. The down and the
 * moves are queued on the CDP session in one burst, without waiting for each
 * reply, so they reach the page back to back, far inside the 300 ms hold,
 * however loaded the machine is. Nothing here measures time: the outcome
 * (the row moved, or it did not) is the assertion.
 */
async function flick(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page)
  const steps = 2
  const burst = [cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })]
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(from.x + ((to.x - from.x) * i) / steps)
    const y = Math.round(from.y + ((to.y - from.y) * i) / steps)
    burst.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }))
  }
  await Promise.all(burst)
  await page.waitForTimeout(60)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
}

test.describe('desktop 1280x900', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false })

  test('every row shows its handle without hover', async ({ page }) => {
    await seed(page, ALL)
    await open(page)
    // The pointer is parked away from every row: nothing is hovered.
    await page.mouse.move(1270, 890)
    for (const { title } of ALL) await expect(handle(page, title)).toBeVisible()
  })

  test('dragging Top 3 row 3 onto row 1 by its handle reorders', async ({ page }) => {
    await seed(page, ALL)
    await open(page)
    const from = await point(handle(page, 'Tthree'))
    const to = await point(page.getByText('Tone', { exact: true }), 0.2)
    await mouseDrag(page, from, to)
    await expect.poll(() => rootsOf(page, 'mustDo')).toEqual(['T3', 'T1', 'T2'])
  })

  test('a Tasks row dropped on a full Top 3 is refused out loud', async ({ page }) => {
    await seed(page, ALL)
    await open(page)
    const from = await point(handle(page, 'Lone'))
    const to = await point(page.getByText('Ttwo', { exact: true }), 0.2)
    await mouseDrag(page, from, to)
    await expect(page.getByText('Top 3 is full. Move one out first.')).toBeVisible()
    expect(await rootsOf(page, 'mustDo')).toEqual(['T1', 'T2', 'T3'])
    expect(await rootsOf(page, 'highPriority')).toEqual(['L1', 'L2'])
  })

  test('with room in the Top 3 a Tasks row still drops in', async ({ page }) => {
    await seed(page, [TOP3[0], TOP3[1], ...LIST])
    await open(page)
    const from = await point(handle(page, 'Lone'))
    const to = await point(page.getByText('Ttwo', { exact: true }), 0.2)
    await mouseDrag(page, from, to)
    await expect.poll(() => rootsOf(page, 'mustDo')).toEqual(['T1', 'L1', 'T2'])
  })
})

test.describe('phone', () => {
  test.use(PHONE)

  test('every row shows its handle, at least 44px square', async ({ page }) => {
    await seed(page, ALL)
    await open(page)
    for (const { title } of ALL) {
      const h = handle(page, title)
      await expect(h).toBeVisible()
      const box = (await h.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('a finger on the handle moves the row with no hold', async ({ page }) => {
    await seed(page, ALL)
    await open(page)
    const from = await point(handle(page, 'Tthree'))
    const to = await point(page.locator('[data-task-id="T1"]'), 0.15)
    expect(from.y - to.y).toBeGreaterThanOrEqual(60)
    await flick(page, from, to)
    await expect.poll(() => rootsOf(page, 'mustDo')).toEqual(['T3', 'T1', 'T2'])
  })

  test('the same quick gesture on the row body does not move it', async ({ page }) => {
    await seed(page, ALL)
    await open(page)
    // The title button (a real <button>), not the handle, which is now first
    // in the row and is also named after the task ("Drag to move Tthree").
    const body = page.locator('[data-task-id="T3"] button').filter({ hasText: 'Tthree' }).first()
    const from = await point(body, 0.5, 0.3)
    const to = await point(page.locator('[data-task-id="T1"]'), 0.15, 0.3)
    await flick(page, from, to)
    expect(await rootsOf(page, 'mustDo')).toEqual(['T1', 'T2', 'T3'])
  })

  test('a finger drag from a Tasks handle into a full Top 3 is refused', async ({ page }) => {
    await seed(page, ALL)
    await open(page)
    const from = await point(handle(page, 'Lone'))
    const to = await point(page.locator('[data-task-id="T2"]'), 0.15)
    await flick(page, from, to)
    await expect(page.getByText('Top 3 is full. Move one out first.')).toBeVisible()
    expect(await rootsOf(page, 'mustDo')).toEqual(['T1', 'T2', 'T3'])
  })

  test('the ⋮ sheet’s Move to Top 3 on a full Top 3 is refused out loud', async ({ page }) => {
    await seed(page, ALL)
    await open(page)
    await page.locator('[data-task-id="L1"]').getByRole('button', { name: 'Task options' }).click()
    const sheet = page.getByTestId('task-action-sheet')
    await expect(sheet).toBeVisible()
    await sheet.getByRole('menuitem', { name: 'Move to Top 3' }).click()
    await expect(page.getByText('Top 3 is full. Move one out first.')).toBeVisible()
    expect(await rootsOf(page, 'mustDo')).toEqual(['T1', 'T2', 'T3'])
    expect(await rootsOf(page, 'highPriority')).toEqual(['L1', 'L2'])
  })

  test('a mouse on a touch device drags by the handle too', async ({ page }) => {
    // A touch laptop or a tablet with a mouse: the rows are the phone
    // anatomy (coarse primary pointer), and a mouse used to be unable to drag.
    await seed(page, ALL)
    await open(page)
    const from = await point(handle(page, 'Tthree'))
    const to = await point(page.locator('[data-task-id="T1"]'), 0.15)
    await mouseDrag(page, from, to)
    await expect.poll(() => rootsOf(page, 'mustDo')).toEqual(['T3', 'T1', 'T2'])
    // The release did not open the row's sheet.
    await expect(page.getByTestId('task-action-sheet')).toHaveCount(0)
  })
})
