/**
 * e2e/minimal-today.spec.ts
 *
 * The minimal rewrite's own surface, as far as it can be driven without a
 * live Convex backend: scheduling without a calendar connection (a time is a
 * note, nothing more), setting a task's length from the sheet, the weekly
 * goal on Review, and the bits that make the app installable on a phone.
 *
 * The connected path (free-slot search, events, the work log) is covered by
 * convex/calendar.test.ts against a mocked Google.
 */

import { test, expect, type Page } from '@playwright/test'

const STATE_KEY = 'deepblock_state_v1'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function seedAndOpen(page: Page, path = '/') {
  await page.addInitScript((key) => {
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    sessionStorage.setItem('deepblock_guest_session', '1')
    if (localStorage.getItem(key)) return
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        state: {
          days: {
            [iso]: {
              date: iso,
              tasks: [{ id: 't1', title: 'Write the report', sectionId: 'highPriority', date: iso, isDone: false }],
              deepWorkSessions: [],
              habitCompletions: {},
            },
          },
          activeDays: [iso],
        },
      }),
    )
  }, STATE_KEY)
  await page.goto(path)
  const guest = page.getByRole('button', { name: 'Continue as guest' })
  if (await guest.isVisible({ timeout: 3_000 }).catch(() => false)) await guest.click()
}

async function readTask(page: Page) {
  return page.evaluate(
    ([key, iso]) => JSON.parse(localStorage.getItem(key)!).state.days[iso].tasks.find((t: { id: string }) => t.id === 't1'),
    [STATE_KEY, todayIso()] as const,
  )
}

test.describe('scheduling without a calendar connection', () => {
  test('a chosen time is saved on the task and shown on its chip', async ({ page }) => {
    await seedAndOpen(page)
    await page.getByRole('button', { name: 'Schedule in calendar' }).first().click()

    const sheet = page.getByRole('dialog', { name: 'Write the report' })
    await expect(sheet).toBeVisible()
    // No calendar: the sheet says a time carries no reminder, and offers no auto-slot.
    await expect(sheet).toContainText('a time is only a note')
    await expect(sheet.getByRole('button', { name: 'Next free slot' })).toHaveCount(0)

    await sheet.getByRole('button', { name: '30m', exact: true }).click()
    await sheet.getByLabel('Start time').fill('14:30')
    await sheet.getByRole('button', { name: 'At this time' }).click()

    await expect(sheet).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Scheduled at 14:30. Change' })).toBeVisible()
    expect(await readTask(page)).toMatchObject({ scheduledAt: '14:30', durationMinutes: 30 })
  })

  test('clearing the time takes it off the task', async ({ page }) => {
    await seedAndOpen(page)
    await page.getByRole('button', { name: 'Schedule in calendar' }).first().click()
    await page.getByLabel('Start time').fill('09:00')
    await page.getByRole('button', { name: 'At this time' }).click()

    await page.getByRole('button', { name: 'Scheduled at 09:00. Change' }).click()
    await page.getByRole('button', { name: 'Clear time' }).click()

    await expect(page.getByRole('button', { name: 'Schedule in calendar' }).first()).toBeVisible()
    expect((await readTask(page)).scheduledAt).toBeUndefined()
  })

  test('"Save length only" sets the duration without a time', async ({ page }) => {
    await seedAndOpen(page)
    await page.getByRole('button', { name: 'Schedule in calendar' }).first().click()
    await page.getByRole('button', { name: '1h', exact: true }).click()
    await page.getByRole('button', { name: 'Save length only' }).click()

    const task = await readTask(page)
    expect(task.durationMinutes).toBe(60)
    expect(task.scheduledAt).toBeUndefined()
  })

  test('Escape closes the sheet without changing anything', async ({ page }) => {
    await seedAndOpen(page)
    await page.getByRole('button', { name: 'Schedule in calendar' }).first().click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect((await readTask(page)).scheduledAt).toBeUndefined()
  })
})

test('guests see no calendar card, signed-out is not "disconnected"', async ({ page }) => {
  await seedAndOpen(page)
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Calendar' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Connect calendar' })).toHaveCount(0)
})

test('the weekly deep work goal is edited on Review and kept', async ({ page }) => {
  await seedAndOpen(page, '/review')
  const goal = page.getByLabel('Weekly deep work goal in hours')
  await expect(goal).toHaveValue('20')
  await goal.fill('12')
  await expect(page.getByText('/ 12h')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Weekly deep work goal in hours')).toHaveValue('12')
})

test('old links land on the planner', async ({ page }) => {
  await seedAndOpen(page, '/finance')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
})

test.describe('installable', () => {
  test('the manifest is linked and its icons are served', async ({ page, request }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBe('/manifest.webmanifest')

    const manifest = await (await request.get(href!)).json()
    expect(manifest).toMatchObject({ name: 'Deepblock', display: 'standalone', start_url: '/' })
    for (const icon of manifest.icons as { src: string; type: string }[]) {
      const res = await request.get(icon.src)
      expect(res.status(), icon.src).toBe(200)
      expect(res.headers()['content-type']).toContain('image/png')
    }
    expect((await request.get('/apple-touch-icon.png')).status()).toBe(200)
  })
})
