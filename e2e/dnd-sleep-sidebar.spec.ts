/**
 * e2e/dnd-sleep-sidebar.spec.ts
 *
 * Regression coverage for three planner fixes:
 *  1. Drag-and-drop: the whole task row is draggable (not just the grip), so
 *     grabbing a task by its body reorders it. Also asserts no crash / blank app.
 *  2. Sleep card: derived from the last block end + wind-down buffer, not a fixed bedtime.
 *  3. Sidebar: consolidated "Focus" card; Motivation folded into the timer; low-use
 *     cards collapsed by default.
 */

import { test, expect, type Page } from '@playwright/test'

async function openPlanner(page: Page) {
  await page.goto('/planner')
  await page.waitForFunction(
    () => {
      if (document.querySelector('[data-tour="date-nav"]')) return true
      const guest = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Continue as guest',
      )
      if (guest) (guest as HTMLButtonElement).click()
      return false
    },
    { timeout: 40_000, polling: 400 },
  )
}

async function dismissModals(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip for today' })
  if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) await skip.click()
}

function seed(page: Page, tasks: Array<Record<string, unknown>>) {
  return page.addInitScript((tasks) => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const appState = {
      days: {
        [today]: {
          date: today,
          tasks: (tasks as Array<Record<string, unknown>>).map((t) => ({ ...t, date: today })),
          habitCompletions: {},
          deepWorkSessions: [],
          wakeTime: '07:00',
          sleepTarget: '23:00',
          bedTime: '22:30',
          shutdownCompletedAt: new Date().toISOString(),
        },
      },
    }
    window.localStorage.setItem('deepblock_state_v1', JSON.stringify({ version: 1, state: appState }))
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
    // The planner auto-opens the shutdown ritual (a full-screen overlay that
    // swallows clicks) from 9 PM local time. Without this the whole suite fails
    // when run in the evening. Key must match DayPlanner's local-date todayIso().
    {
      const d = new Date()
      const localIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      window.sessionStorage.setItem(`shutdown_reminder_shown_${localIso}`, '1')
    }
  }, tasks)
}

/** Visible order of the three marker tasks. */
function readOrder(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('span'))
      .map((s) => s.textContent?.trim())
      .filter((t) => t === 'AAA' || t === 'BBB' || t === 'CCC'),
  )
}

/** Drive a real mouse drag from one element's centre onto the lower edge of another. */
async function mouseDrag(
  page: Page,
  from: ReturnType<Page['getByText']>,
  to: ReturnType<Page['getByText']>,
) {
  const sb = await from.boundingBox()
  const db = await to.boundingBox()
  if (!sb || !db) throw new Error('drag source/target not visible')
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await page.mouse.down()
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(db.x + db.width / 2, db.y + db.height - 3, { steps: 2 })
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await page.waitForTimeout(400)
}

/**
 * Open a section regardless of the clock.
 *
 * Sections default to collapsed unless their own time block is running, so a
 * spec that seeds High Priority tasks and runs in the evening finds an empty
 * section. Expanding explicitly makes these tests say what they mean and stops
 * them depending on the hour they are run at.
 */
async function expandSection(page: Page, heading: string) {
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: heading }) })
    .first()
  const expand = section.getByRole('button', { name: 'Expand section' })
  if (await expand.count()) await expand.click()
  await page.waitForTimeout(200)
}

test('dragging a task by its body reorders it (no crash)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await seed(page, [
    { id: 'A', title: 'AAA', sectionId: 'highPriority', isDone: false },
    { id: 'B', title: 'BBB', sectionId: 'highPriority', isDone: false },
    { id: 'C', title: 'CCC', sectionId: 'highPriority', isDone: false },
  ])
  await openPlanner(page)
  await dismissModals(page)
  await expandSection(page, 'High Priority (Focus Tasks)')
  await page.getByText('AAA', { exact: true }).waitFor({ timeout: 10_000 })

  expect(await readOrder(page)).toEqual(['AAA', 'BBB', 'CCC'])

  // Drag the FIRST task by its title (not the grip) down past the last one.
  await mouseDrag(page, page.getByText('AAA', { exact: true }), page.getByText('CCC', { exact: true }))

  expect(await readOrder(page)).toEqual(['BBB', 'CCC', 'AAA'])
  expect(await page.locator('[data-tour="date-nav"]').count(), errors.join(' || ')).toBeGreaterThan(0)
  expect(errors, errors.join(' || ')).toHaveLength(0)
})

test('clicking a task checkbox toggles it instead of starting a drag', async ({ page }) => {
  await seed(page, [{ id: 'A', title: 'AAA', sectionId: 'highPriority', isDone: false }])
  await openPlanner(page)
  await dismissModals(page)
  await expandSection(page, 'High Priority (Focus Tasks)')
  const checkbox = page.getByRole('checkbox').first()
  await checkbox.waitFor({ timeout: 10_000 })
  await checkbox.click()
  await expect(checkbox).toBeChecked()
})

test('sleep card is demand-derived and sidebar is consolidated', async ({ page }) => {
  // A realistically full day so the night block ends in the evening (non-capped path).
  await seed(page, [
    { id: 'm0', title: 'Morning routine', sectionId: 'morningRoutine', isDone: false, durationMinutes: 60 },
    { id: 'h0', title: 'Deep work', sectionId: 'highPriority', isDone: false, durationMinutes: 480 },
    { id: 'md0', title: 'Admin', sectionId: 'mediumPriority', isDone: false, durationMinutes: 180 },
    { id: 'lo0', title: 'Errand', sectionId: 'lowPriority', isDone: false, durationMinutes: 120 },
    { id: 'n0', title: 'Night routine', sectionId: 'nightRoutine', isDone: false, durationMinutes: 60 },
  ])
  await openPlanner(page)
  await dismissModals(page)

  const sleep = page.locator('section[aria-label="Sleep block"]').first()
  await expect(sleep).toBeVisible({ timeout: 10_000 })
  await expect(sleep).toContainText('after 20m wind-down')
  await expect(sleep).toContainText('→')

  await expect(page.getByRole('button', { name: /Focus/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Motivation/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Expand Not doing' })).toBeVisible()
})
