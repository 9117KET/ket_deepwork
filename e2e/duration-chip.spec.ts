/**
 * e2e/duration-chip.spec.ts
 *
 * A duration on every row, typed or picked (run 2026-11-07, spec 02).
 *
 * On a desktop every root row shows a quiet chip without hover: the length
 * when set, a dim "Time" when not. It opens a small popover with a typed field
 * ("1h 30m", "45", "1:30") above the ladder as pills. On a phone the row's one
 * chip reads "Time" too and opens the schedule sheet, which has the same field.
 * A length typed at the end of a new task's title is split off and set.
 */

import { expect, test, type Page } from '@playwright/test'
import { PHONE } from './helpers/mobile'

const STATE_KEY = 'deepblock_state_v1'

interface SeedTask {
  id: string
  title: string
  sectionId: 'mustDo' | 'highPriority'
  durationMinutes?: number
}

const SEED: SeedTask[] = [
  { id: 'top-1', title: 'Draft the proposal', sectionId: 'mustDo' },
  { id: 'top-2', title: 'Answer the landlord', sectionId: 'mustDo' },
  { id: 'top-3', title: 'Review the contract', sectionId: 'mustDo' },
  { id: 'list-1', title: 'Water the plants', sectionId: 'highPriority' },
  { id: 'list-2', title: 'Sort the receipts', sectionId: 'highPriority' },
]

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
                tasks: tasks.map((t) => ({ date: iso, isDone: false, ...t })),
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

async function readTasks(page: Page): Promise<Array<{ id: string; title: string; durationMinutes?: number }>> {
  return page.evaluate(
    ([key, iso]) => JSON.parse(localStorage.getItem(key)!).state.days[iso].tasks,
    [STATE_KEY, todayIso()] as const,
  )
}

async function readTask(page: Page, id: string) {
  return (await readTasks(page)).find((t) => t.id === id)
}

/** A desktop row: the parent of the label holding its title. */
function desktopRow(page: Page, title: string) {
  return page.locator('label').filter({ hasText: title }).locator('xpath=..').first()
}

function chipOf(page: Page, title: string) {
  return desktopRow(page, title).getByRole('button', { name: /^How long/ })
}

function gauge(page: Page) {
  return page.locator('[data-tour="date-nav"]').getByRole('meter')
}

test.describe('the duration chip on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('every root row shows a chip without hover', async ({ page }) => {
    await openWith(page, SEED)
    await page.mouse.move(0, 0)
    const chips = page.getByRole('button', { name: /^How long/ })
    await expect(chips).toHaveCount(5)
    for (const chip of await chips.all()) {
      await expect(chip).toBeVisible()
      await expect(chip).toHaveText('Time')
      await expect(chip).toHaveAttribute('aria-label', 'How long: not set')
      await expect(chip).toHaveCSS('opacity', '1')
    }
  })

  test('typing a length and pressing Enter sets it, and the gauge follows', async ({ page }) => {
    await openWith(page, SEED)
    const before = await gauge(page).getAttribute('aria-valuetext')

    const chip = chipOf(page, 'Water the plants')
    await chip.click()
    const popover = page.getByRole('dialog', { name: 'How long' })
    await expect(popover).toBeVisible()
    const field = popover.getByRole('textbox', { name: 'Type how long' })
    await expect(field).toBeFocused()
    await expect(field).toHaveAttribute('placeholder', '2h 30m, 45m or 1:30')
    // A popover, not a sheet: the app behind stays live.
    await expect(page.locator('#root')).not.toHaveAttribute('inert', /.*/)

    await field.fill('1h 30m')
    await field.press('Enter')
    await expect(popover).toHaveCount(0)
    await expect(chip).toHaveText('1h30')
    await expect(chip).toHaveAttribute('aria-label', 'How long: 1h30')
    await expect(chip).toBeFocused()
    expect(await readTask(page, 'list-1')).toMatchObject({ durationMinutes: 90 })
    await expect(gauge(page)).not.toHaveAttribute('aria-valuetext', before ?? '')
  })

  test('an off-ladder typed length is kept and shown in order among the pills', async ({ page }) => {
    await openWith(page, SEED)
    const chip = chipOf(page, 'Sort the receipts')
    await chip.click()
    const popover = page.getByRole('dialog', { name: 'How long' })
    await popover.getByRole('textbox').fill('100')
    await popover.getByRole('textbox').press('Enter')
    expect(await readTask(page, 'list-2')).toMatchObject({ durationMinutes: 100 })
    await expect(chip).toHaveText('1h40')

    await chip.click()
    const pills = popover.getByRole('group', { name: 'Pick a length' }).getByRole('button')
    expect(await pills.allTextContents()).toEqual([
      '10m', '15m', '20m', '30m', '45m', '1h', '1h30', '1h40', '2h', '3h', '4h', '5h', '6h', '7h', '8h',
    ])
    await expect(pills.filter({ hasText: /^1h40$/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('an unreadable length shows the error line and saves nothing', async ({ page }) => {
    await openWith(page, SEED)
    await chipOf(page, 'Water the plants').click()
    const popover = page.getByRole('dialog', { name: 'How long' })
    await popover.getByRole('textbox').fill('soon')
    await popover.getByRole('textbox').press('Enter')
    await expect(popover.getByRole('alert')).toHaveText('Try 2h 30m, 45m or 1:30')
    expect((await readTask(page, 'list-1'))?.durationMinutes).toBeUndefined()
  })

  test('a pill sets the length, Clear unsets it, Escape changes nothing', async ({ page }) => {
    await openWith(page, SEED)
    const chip = chipOf(page, 'Draft the proposal')
    const popover = page.getByRole('dialog', { name: 'How long' })

    await chip.click()
    await popover.getByRole('button', { name: '45m', exact: true }).click()
    await expect(popover).toHaveCount(0)
    await expect(chip).toHaveText('45m')
    expect(await readTask(page, 'top-1')).toMatchObject({ durationMinutes: 45 })

    await chip.click()
    await popover.getByRole('textbox').fill('3h')
    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
    await expect(chip).toBeFocused()
    await expect(chip).toHaveText('45m')
    expect(await readTask(page, 'top-1')).toMatchObject({ durationMinutes: 45 })

    await chip.click()
    await popover.getByRole('button', { name: 'Clear' }).click()
    await expect(chip).toHaveText('Time')
    expect((await readTask(page, 'top-1'))?.durationMinutes).toBeUndefined()
  })

  test('a click outside closes it', async ({ page }) => {
    await openWith(page, SEED)
    await chipOf(page, 'Water the plants').click()
    const popover = page.getByRole('dialog', { name: 'How long' })
    await expect(popover).toBeVisible()
    await page.mouse.click(5, 450)
    await expect(popover).toHaveCount(0)
  })

  test('a click outside keeps a valid typed length', async ({ page }) => {
    await openWith(page, SEED)
    const chip = chipOf(page, 'Water the plants')
    await chip.click()
    const popover = page.getByRole('dialog', { name: 'How long' })
    await popover.getByRole('textbox').fill('2h 30m')
    await page.mouse.click(5, 450)
    await expect(popover).toHaveCount(0)
    await expect(chip).toHaveText('2h30')
    expect(await readTask(page, 'list-1')).toMatchObject({ durationMinutes: 150 })
  })

  test('a click outside with unreadable text closes and saves nothing', async ({ page }) => {
    await openWith(page, [{ ...SEED[3], durationMinutes: 45 }, SEED[4]])
    const chip = chipOf(page, 'Water the plants')
    await chip.click()
    const popover = page.getByRole('dialog', { name: 'How long' })
    await popover.getByRole('textbox').fill('soon')
    await page.mouse.click(5, 450)
    await expect(popover).toHaveCount(0)
    await expect(chip).toHaveText('45m')
    expect(await readTask(page, 'list-1')).toMatchObject({ durationMinutes: 45 })
  })

  test('Tab away keeps a valid typed length and traps nothing', async ({ page }) => {
    await openWith(page, SEED)
    const popover = page.getByRole('dialog', { name: 'How long' })

    // Forward: Tab past the last control leaves the popover for the page.
    const chip = chipOf(page, 'Water the plants')
    await chip.click()
    await popover.getByRole('textbox').fill('45')
    for (let i = 0; i < 25 && (await popover.count()) > 0; i++) await page.keyboard.press('Tab')
    await expect(popover).toHaveCount(0)
    expect(await readTask(page, 'list-1')).toMatchObject({ durationMinutes: 45 })
    const focusedInPage = await page.evaluate(
      () => document.activeElement !== document.body && Boolean(document.getElementById('root')?.contains(document.activeElement)),
    )
    expect(focusedInPage).toBe(true)

    // Backward: Shift+Tab off the field goes back to the chip.
    const other = chipOf(page, 'Sort the receipts')
    await other.click()
    await popover.getByRole('textbox').fill('1:30')
    await page.keyboard.press('Shift+Tab')
    await expect(popover).toHaveCount(0)
    await expect(other).toBeFocused()
    expect(await readTask(page, 'list-2')).toMatchObject({ durationMinutes: 90 })
  })

  test('Escape closes it while focus rests on the chip, saving nothing', async ({ page }) => {
    await openWith(page, SEED)
    const chip = chipOf(page, 'Water the plants')
    await chip.click()
    const popover = page.getByRole('dialog', { name: 'How long' })
    await popover.getByRole('textbox').fill('3h')
    await chip.focus()
    await expect(popover).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
    await expect(chip).toBeFocused()
    expect((await readTask(page, 'list-1'))?.durationMinutes).toBeUndefined()
  })

  test('the Top 3 add line splits off a typed length too', async ({ page }) => {
    await openWith(page, [SEED[0], SEED[3]])
    await page.getByRole('button', { name: '+ Add', exact: true }).click()
    const add = page.getByPlaceholder('Add a top priority for today…')
    await add.fill('Deep work 2h 30m')
    await add.press('Enter')

    await expect(chipOf(page, 'Deep work')).toHaveText('2h30')
    const added = (await readTasks(page)).find((t) => t.title === 'Deep work')
    expect(added).toMatchObject({ title: 'Deep work', sectionId: 'mustDo', durationMinutes: 150 })
  })

  test('a length typed at the end of a new task is split off and set', async ({ page }) => {
    await openWith(page, SEED)
    const add = page.getByPlaceholder('Add a task', { exact: true })
    await add.fill('Write report 2h')
    await add.press('Enter')

    await expect(chipOf(page, 'Write report')).toHaveText('2h')
    const added = (await readTasks(page)).find((t) => t.title === 'Write report')
    expect(added).toMatchObject({ title: 'Write report', durationMinutes: 120 })
    expect((await readTasks(page)).some((t) => t.title.includes('2h'))).toBe(false)
  })
})

test.describe('the duration chip on a phone', () => {
  test.use(PHONE)

  test('reads "Time", opens the schedule sheet, and a typed 45 saves 45m', async ({ page }) => {
    await openWith(page, SEED)
    const row = page.locator('[data-task-id="list-1"]')
    const chip = row.getByRole('button', { name: 'How long: not set. Schedule' })
    await expect(chip).toBeVisible()
    await expect(chip).toHaveText('Time')

    await chip.click()
    const sheet = page.getByRole('dialog', { name: 'Water the plants' })
    await expect(sheet).toBeVisible()
    const field = sheet.getByRole('textbox', { name: 'Type how long' })
    await field.fill('45')
    await field.press('Enter')
    await expect(sheet).toHaveCount(0)
    expect(await readTask(page, 'list-1')).toMatchObject({ durationMinutes: 45 })
    await expect(row.getByRole('button', { name: /Schedule$/ })).toHaveText('45m')
  })
})
