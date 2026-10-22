/**
 * e2e/mobile-today.spec.ts
 *
 * Today on a phone (run 2026-10-22, spec 02).
 *
 * A row on a phone is a thumb-sized checkbox, a title you can read in full,
 * one chip and a ⋮ that opens a sheet with every other action. Nothing depends
 * on hover, right-click, double-tap or drag, because a phone has none of them.
 * These pin that shape against the rich seed, which has the long titles, the
 * subtask, the done rows and the earned minutes that break a phone layout.
 */

import { expect, test, type Page } from '@playwright/test'
import {
  LONG_TITLE_LIST,
  PHONE,
  RICH_IDS,
  hiddenControls,
  seedRichDay,
  tinyTexts,
  undersizedTouchTargets,
} from './helpers/mobile'

test.use(PHONE)

async function openToday(page: Page) {
  await seedRichDay(page)
  await page.goto('/')
  await expect(page.locator('[data-tour="date-nav"]')).toBeVisible({ timeout: 40_000 })
  await expect(page.getByText(LONG_TITLE_LIST)).toBeVisible()
}

/** The "Tasks" list card. */
function taskList(page: Page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Tasks', exact: true }) })
    .first()
}

/** A row's own block (the row plus its progress bar), by task id. */
function row(page: Page, taskId: string) {
  return page.locator(`[data-task-id="${taskId}"]`)
}

async function openActions(page: Page, taskId: string) {
  await row(page, taskId).getByRole('button', { name: 'Task options' }).first().click()
  const sheet = page.getByTestId('task-action-sheet')
  await expect(sheet).toBeVisible()
  return sheet
}

function expectNoneUndersized(tiny: Awaited<ReturnType<typeof undersizedTouchTargets>>, where: string) {
  expect(tiny, `${where}: ${tiny.length} control(s) under 44x44:\n${JSON.stringify(tiny.slice(0, 12), null, 2)}`).toEqual([])
}

test('every control on Today is thumb-sized, with and without a sheet open', async ({ page }) => {
  await openToday(page)
  expectNoneUndersized(await undersizedTouchTargets(page), 'Today')

  // The first list task's ⋮ sheet.
  const sheet = await openActions(page, RICH_IDS.listLong)
  expectNoneUndersized(await undersizedTouchTargets(page), 'the ⋮ sheet')

  // Its Schedule action opens the schedule sheet in its place.
  await sheet.getByRole('menuitem', { name: /schedule/i }).click()
  await expect(page.getByRole('dialog', { name: LONG_TITLE_LIST })).toBeVisible()
  expectNoneUndersized(await undersizedTouchTargets(page), 'the schedule sheet')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // The progress sheet, from the bar under the 90-minute Top 3 task.
  await row(page, RICH_IDS.topScheduled).getByTestId('task-progress-bar').click()
  await expect(page.getByRole('dialog', { name: /Log time on/ })).toBeVisible()
  expectNoneUndersized(await undersizedTouchTargets(page), 'the progress sheet')
})

test('no text on Today is under 11px', async ({ page }) => {
  await openToday(page)
  const tiny = await tinyTexts(page, 11)
  expect(tiny, `text under 11px:\n${JSON.stringify(tiny, null, 2)}`).toEqual([])
})

test('no control on Today is hidden until hovered', async ({ page }) => {
  await openToday(page)
  const hidden = await hiddenControls(page)
  expect(hidden, `hover-only controls:\n${JSON.stringify(hidden, null, 2)}`).toEqual([])
})

test('a long title wraps to two lines and is never shortened in the DOM', async ({ page }) => {
  await openToday(page)
  const title = taskList(page).getByText(LONG_TITLE_LIST, { exact: true })
  const measured = await title.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(el).lineHeight),
    text: el.textContent ?? '',
  }))
  expect(measured.text).toBe(LONG_TITLE_LIST)
  expect(measured.text).not.toContain('…')
  expect(
    measured.height,
    `title is ${measured.height}px tall at a ${measured.lineHeight}px line height`,
  ).toBeGreaterThanOrEqual(2 * measured.lineHeight - 1)

  // The sheet header shows it whole, whatever the row clamps.
  await openActions(page, RICH_IDS.listLong)
  await expect(page.getByRole('heading', { name: LONG_TITLE_LIST, exact: true })).toBeVisible()
})

test('a Top 3 row has a ⋮ that reaches Delete and Schedule by touch', async ({ page }) => {
  await openToday(page)
  const sheet = await openActions(page, RICH_IDS.topScheduled)
  await expect(sheet.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
  await expect(sheet.getByRole('menuitem', { name: /schedule/i })).toBeVisible()
  // A guest has no challenge, so there is no partner to hide from.
  await expect(sheet.getByRole('menuitem', { name: 'Hide from partner' })).toHaveCount(0)
})

test('the progress bar under a task is one button that opens the progress sheet', async ({ page }) => {
  await openToday(page)
  const bars = row(page, RICH_IDS.topScheduled).getByTestId('task-progress-bar')
  await expect(bars).toHaveCount(1)
  await expect(bars).toContainText('45m / 1h30')
  await bars.click()
  const dialog = page.getByRole('dialog', { name: /Log time on/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Log time by hand')).toBeVisible()
})

test('the action sheet clears the tab bar', async ({ page }) => {
  await openToday(page)
  await openActions(page, RICH_IDS.listLong)
  const geom = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-testid="task-action-sheet"] [role="menuitem"]')
    const last = items[items.length - 1]!.getBoundingClientRect()
    const bar = document.querySelector('[data-testid="mobile-tab-bar"]')!
    const barBox = bar.getBoundingClientRect()
    // What a finger would hit in the middle of the bar.
    const hit = document.elementFromPoint(barBox.left + barBox.width / 2, barBox.top + barBox.height / 2)
    return { lastBottom: last.bottom, barTop: barBox.top, barCovered: !bar.contains(hit) }
  })
  expect(
    geom.lastBottom <= geom.barTop || geom.barCovered,
    `last action ends at ${geom.lastBottom}px; tab bar starts at ${geom.barTop}px and is ${geom.barCovered ? '' : 'not '}covered`,
  ).toBe(true)
})

test('Today with a busy day stays under 1,800px', async ({ page }) => {
  await openToday(page)
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(height).toBeLessThan(1800)
})

test('nothing on a phone is draggable or asks for a right-click', async ({ page }) => {
  await openToday(page)
  await expect(page.locator('[draggable="true"]')).toHaveCount(0)
  await expect(page.locator('[title*="right-click" i], [aria-label*="right-click" i]')).toHaveCount(0)
})

test('Move down in the sheet puts the first task below the second', async ({ page }) => {
  await openToday(page)
  const order = () =>
    taskList(page)
      .locator('[data-task-id]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-task-id')))

  const before = await order()
  expect(before.slice(0, 2)).toEqual([RICH_IDS.listLong, RICH_IDS.listParent])

  const sheet = await openActions(page, RICH_IDS.listLong)
  await expect(sheet.getByRole('menuitem', { name: 'Move up' })).toBeDisabled()
  await sheet.getByRole('menuitem', { name: 'Move down' }).click()
  await expect(sheet).toHaveCount(0)

  await expect.poll(order).not.toEqual(before)
  const after = await order()
  expect(after.indexOf(RICH_IDS.listLong)).toBeGreaterThan(after.indexOf(RICH_IDS.listParent))
})

test('?tab=habits switches the panel while the planner is mounted', async ({ page }) => {
  await openToday(page)
  await expect(page.getByTestId('mobile-habits')).toHaveCount(0)
  // In-app navigation: the router hears popstate, the planner stays mounted.
  await page.evaluate(() => {
    window.history.pushState({}, '', '/?tab=habits')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByTestId('mobile-habits')).toBeVisible()
})
