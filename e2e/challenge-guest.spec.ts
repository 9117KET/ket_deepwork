/**
 * e2e/challenge-guest.spec.ts
 *
 * The challenge routes as a guest, the one identity e2e can drive (a
 * challenge needs two signed-in accounts on a live backend). Every route
 * must show the sign-in form, light Challenges in the phone's tab bar, and
 * not crash, on a phone and on a desktop.
 *
 * Also the shared sheet's contract, proven on the guest's ScheduleSheet
 * (every challenge sheet is the same component): focus moves in on open, Tab
 * stays inside, the app behind is inert, Escape closes and focus returns.
 */

import { test, expect, type Page } from '@playwright/test'
import { PHONE } from './helpers/mobile'

const ROUTES = ['/challenge', '/challenge/new', '/challenge/abc', '/admin/challenges'] as const

async function guest(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('deepblock_guest_session', '1')
    window.localStorage.setItem('deepblock_tour_done', '1')
  })
}

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

for (const route of ROUTES) {
  test.describe(route, () => {
    test(`phone: sign-in form, Challenges lit`, async ({ browser }) => {
      const context = await browser.newContext({ ...PHONE })
      const page = await context.newPage()
      const errors = watchErrors(page)
      await guest(page)
      await page.goto(route)

      await expect(page.locator('#email')).toBeVisible()
      await expect(page.getByText('Something went wrong')).toHaveCount(0)
      const bar = page.getByTestId('mobile-tab-bar')
      await expect(bar).toBeVisible()
      const tab = bar.getByRole('link', { name: 'Challenges', exact: true })
      await expect(tab).toHaveAttribute('aria-current', 'page')
      await expect(tab).toHaveAttribute('href', '/challenge')
      // Only one destination is lit.
      await expect(bar.locator('[aria-current="page"]')).toHaveCount(1)
      expect(errors, `page errors on ${route}`).toEqual([])
      await context.close()
    })

    test(`desktop: sign-in form, no crash`, async ({ page }) => {
      const errors = watchErrors(page)
      await guest(page)
      await page.goto(route)
      await expect(page.locator('#email')).toBeVisible()
      await expect(page.getByText('Something went wrong')).toHaveCount(0)
      expect(errors, `page errors on ${route}`).toEqual([])
    })
  })
}

test('the Challenges tab is not lit on Today', async ({ browser }) => {
  const context = await browser.newContext({ ...PHONE })
  const page = await context.newPage()
  await guest(page)
  await page.goto('/')
  const bar = page.getByTestId('mobile-tab-bar')
  await expect(bar).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Challenges', exact: true })).not.toHaveAttribute('aria-current', 'page')
  await context.close()
})

test.describe('the shared sheet', () => {
  async function openScheduleSheet(page: Page) {
    await page.addInitScript(() => {
      const d = new Date()
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      sessionStorage.setItem('deepblock_guest_session', '1')
      localStorage.setItem('deepblock_tour_done', '1')
      sessionStorage.setItem(`shutdown_reminder_shown_${iso}`, '1')
      localStorage.setItem(
        'deepblock_state_v1',
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
    })
    await page.goto('/')
    const opener = page.getByRole('button', { name: 'Schedule in calendar' }).first()
    await opener.click()
    const sheet = page.getByRole('dialog', { name: 'Write the report' })
    await expect(sheet).toBeVisible()
    return sheet
  }

  test('focus moves in, Tab stays inside, the app behind is inert', async ({ page }) => {
    const sheet = await openScheduleSheet(page)
    await expect(sheet).toHaveAttribute('aria-modal', 'true')

    const inSheet = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
    expect(await inSheet(), 'focus did not move into the sheet on open').toBe(true)

    // Twice round the sheet's controls in both directions: focus never leaves it.
    const count = await sheet.locator('button:not([disabled]), input, a[href]').count()
    for (let i = 0; i < count * 2 + 2; i++) {
      await page.keyboard.press('Tab')
      expect(await inSheet(), `Tab #${i + 1} left the sheet`).toBe(true)
    }
    for (let i = 0; i < count + 2; i++) {
      await page.keyboard.press('Shift+Tab')
      expect(await inSheet(), `Shift+Tab #${i + 1} left the sheet`).toBe(true)
    }

    // The page behind cannot be reached at all while the sheet is open.
    expect(await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    expect(await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'))).toBe(false)
    // Focus goes back to the control that opened it.
    await expect(page.getByRole('button', { name: 'Schedule in calendar' }).first()).toBeFocused()
  })

  test('a tap on the scrim closes it', async ({ page }) => {
    const sheet = await openScheduleSheet(page)
    // Top-left corner: scrim, never the sheet (bottom on a phone, centred on a desktop).
    await page.mouse.click(5, 5)
    await expect(sheet).toHaveCount(0)
  })
})
