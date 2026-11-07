/**
 * e2e/day-completion.spec.ts
 *
 * The hour ladder and the day's gauge (run 2026-11-02, spec 01).
 *
 * A task's length comes from one ascending list, the short errands then 30m to
 * 8h, on a desktop row and in the phone's schedule sheet alike. The header
 * shows one gauge: planned minutes done out of planned minutes, with a task
 * that has no duration counted as 30m and the line saying how many were.
 */

import { expect, test, type Page } from '@playwright/test'
import { PHONE } from './helpers/mobile'

const STATE_KEY = 'deepblock_state_v1'

/** formatMinutes of durationOptions(): the list both pickers must offer. */
const LADDER = ['10m', '15m', '20m', '30m', '45m', '1h', '1h30', '2h', '3h', '4h', '5h', '6h', '7h', '8h']

interface SeedTask {
  id: string
  title: string
  isDone?: boolean
  durationMinutes?: number
}

/** 1h done, 30m open, one with no duration: "1h of 2h done · 50% · 1 counted as 30m". */
const MIXED: SeedTask[] = [
  { id: 't-hour', title: 'Draft the proposal', isDone: true, durationMinutes: 60 },
  { id: 't-half', title: 'Answer the landlord', durationMinutes: 30 },
  { id: 't-unset', title: 'Water the plants' },
]

/** Stored off the ladder: 150 minutes must show as 2h30, between 2h and 3h. */
const EXTRA: SeedTask[] = [{ id: 't-odd', title: 'Sort the receipts', durationMinutes: 150 }]

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function openWith(page: Page, tasks: SeedTask[]) {
  await page.addInitScript(
    ({ key, tasks }) => {
      const d = new Date()
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      sessionStorage.setItem('deepblock_guest_session', '1')
      localStorage.setItem('deepblock_tour_done', '1')
      if (localStorage.getItem(key)) return
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          state: {
            days: {
              [iso]: {
                date: iso,
                tasks: tasks.map((t) => ({ sectionId: 'highPriority', date: iso, isDone: false, ...t })),
                deepWorkSessions: [],
                habitCompletions: {},
              },
            },
            activeDays: [iso],
          },
        }),
      )
    },
    { key: STATE_KEY, tasks },
  )
  await page.goto('/')
  await expect(page.locator('[data-tour="date-nav"]')).toBeVisible({ timeout: 40_000 })
}

function header(page: Page) {
  return page.locator('[data-tour="date-nav"]')
}

function gauge(page: Page) {
  return header(page).getByRole('meter')
}

async function readTask(page: Page, id: string) {
  return page.evaluate(
    ([key, iso, id]) =>
      JSON.parse(localStorage.getItem(key)!).state.days[iso].tasks.find((t: { id: string }) => t.id === id),
    [STATE_KEY, todayIso(), id] as const,
  )
}

/**
 * A task's row by id. The phone row carries `data-task-id`; the desktop row
 * does not, so it is found as the parent of the label holding its title.
 */
function row(page: Page, id: string) {
  const title = [...MIXED, ...EXTRA].find((t) => t.id === id)!.title
  return page
    .locator(`[data-task-id="${id}"]`)
    .or(page.locator('label').filter({ hasText: title }).locator('xpath=..'))
    .first()
}

async function tick(page: Page, id: string) {
  await row(page, id).getByRole('checkbox').first().click()
}

for (const [where, use] of [
  ['desktop', { viewport: { width: 1280, height: 900 } }],
  ['phone', PHONE],
] as const) {
  test.describe(`day gauge on ${where}`, () => {
    test.use(use)

    test('reads planned minutes done, counts an unset task as 30m, and follows a tick', async ({ page }) => {
      await openWith(page, MIXED)
      await expect(page.getByText('Water the plants')).toBeVisible()

      const meter = gauge(page)
      await expect(meter).toHaveText('1h of 2h done · 50% · 1 counted as 30m')
      await expect(meter).toHaveAttribute('aria-valuenow', '50')
      await expect(meter).toHaveAttribute('aria-valuemin', '0')
      await expect(meter).toHaveAttribute('aria-valuemax', '100')
      await expect(meter).toHaveAttribute(
        'aria-valuetext',
        '1 hour of 2 hours done, 50 percent, 1 task counted as 30 minutes',
      )
      // The old root count is gone from Today.
      await expect(header(page)).not.toContainText(/\d+\/\d+ done/)

      await tick(page, 't-half')
      await expect(meter).toHaveText('1h30 of 2h done · 75% · 1 counted as 30m')
      await expect(meter).toHaveAttribute('aria-valuenow', '75')
    })

    test('starts at zero and is absent on an empty day', async ({ page }) => {
      await openWith(page, [
        { id: 'a', title: 'Plan the week', durationMinutes: 60 },
        { id: 'b', title: 'Call the bank', durationMinutes: 30 },
      ])
      await expect(gauge(page)).toHaveText('0m of 1h30 done · 0%')

      await page.getByRole('button', { name: 'Next day' }).click()
      await expect(header(page)).toBeVisible()
      await expect(gauge(page)).toHaveCount(0)
    })
  })
}

test.describe('the desktop row picker', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('offers the ladder in order and keeps an off-ladder 2h30 in its place', async ({ page }) => {
    await openWith(page, [...MIXED, ...EXTRA])
    await expect(page.getByText('Water the plants')).toBeVisible()

    // The chip is always visible (run 2026-11-07, spec 02): "Time" when
    // unset, the length when set, with no hover needed.
    await page.mouse.move(0, 0)
    const unset = row(page, 't-unset').getByRole('button', { name: /^How long/ })
    await expect(unset).toHaveText('Time')
    await expect(unset).toHaveCSS('opacity', '1')
    const odd = row(page, 't-odd').getByRole('button', { name: /^How long/ })
    await expect(odd).toHaveText('2h30')

    const popover = page.getByRole('dialog', { name: 'How long' })
    const pills = popover.getByRole('group', { name: 'Pick a length' }).getByRole('button')

    await odd.click()
    expect(await pills.allTextContents()).toEqual(['10m', '15m', '20m', '30m', '45m', '1h', '1h30', '2h', '2h30', '3h', '4h', '5h', '6h', '7h', '8h'])
    await expect(pills.filter({ hasText: /^2h30$/ })).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')

    await unset.click()
    expect(await pills.allTextContents()).toEqual(LADDER)

    // Choosing from the list stores minutes.
    await pills.filter({ hasText: /^3h$/ }).click()
    expect(await readTask(page, 't-unset')).toMatchObject({ durationMinutes: 180 })
  })
})

test.describe('the phone schedule sheet', () => {
  test.use(PHONE)

  test('offers the same ladder and saves 2h as 120 minutes', async ({ page }) => {
    await openWith(page, MIXED)
    await row(page, 't-unset').getByRole('button', { name: 'Task options' }).first().click()
    await page.getByTestId('task-action-sheet').getByRole('menuitem', { name: /schedule/i }).click()

    const sheet = page.getByRole('dialog', { name: 'Water the plants' })
    await expect(sheet).toBeVisible()
    const lengths = sheet.getByRole('group', { name: 'Pick a length' }).getByRole('button')
    expect(await lengths.allTextContents()).toEqual(LADDER)

    await lengths.filter({ hasText: /^2h$/ }).click()
    await sheet.getByRole('button', { name: 'Save length only' }).click()
    await expect(sheet).toHaveCount(0)
    expect(await readTask(page, 't-unset')).toMatchObject({ durationMinutes: 120 })
  })
})
