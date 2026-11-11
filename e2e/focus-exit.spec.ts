/**
 * e2e/focus-exit.spec.ts
 *
 * Leaving Focus is a change of view, never a change to the block. A clear
 * "Exit focus" button on a desktop and on a phone, a "Back to focus" in the
 * desktop sidebar while the block still runs, and every way out leaves the
 * countdown (or the pause) exactly as it was. See `docs/data-safety.md`:
 * worked minutes are sacred.
 */

import { test, expect, type Page } from '@playwright/test'
import { PHONE } from './helpers/mobile'

const STATE_KEY = 'deepblock_state_v1'
const BLOCK_KEY = 'deepblock_active_block_v1'
const TASK_ID = 'focus-exit-task'

/** Today with one task and a block on it mid-run (or paused), no waiting. */
async function seed(page: Page, status: 'running' | 'paused') {
  await page.addInitScript(
    ([stateKey, blockKey, taskId, blockStatus]) => {
      const d = new Date()
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      window.sessionStorage.setItem('deepblock_guest_session', '1')
      localStorage.setItem('deepblock_tour_done', '1')
      sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
      sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
      sessionStorage.setItem(`shutdown_reminder_shown_${iso}`, '1')
      // Seed once: a reload must read what the app wrote, not this again.
      if (sessionStorage.getItem('focus_exit_seeded')) return
      sessionStorage.setItem('focus_exit_seeded', '1')
      localStorage.setItem(
        stateKey,
        JSON.stringify({
          version: 1,
          state: {
            days: {
              [iso]: {
                date: iso,
                tasks: [
                  {
                    id: taskId,
                    title: 'Draft the focus exit spec',
                    sectionId: 'highPriority',
                    durationMinutes: 90,
                    date: iso,
                    isDone: false,
                  },
                ],
                deepWorkSessions: [],
                habitCompletions: {},
              },
            },
            activeDays: [iso],
          },
        }),
      )
      const total = 45
      const left = 30
      localStorage.setItem(
        blockKey,
        JSON.stringify({
          dayIso: iso,
          taskId,
          label: 'Deep work block',
          totalMinutes: total,
          startedAt: new Date(Date.now() - (total - left) * 60_000).toISOString(),
          status: blockStatus,
          endsAt: blockStatus === 'running' ? Date.now() + left * 60_000 : null,
          remainingMs: blockStatus === 'paused' ? left * 60_000 : 0,
        }),
      )
    },
    [STATE_KEY, BLOCK_KEY, TASK_ID, status] as const,
  )
}

async function open(page: Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle').catch(() => {})
  const guest = page.getByRole('button', { name: 'Continue as guest' })
  if (await guest.isVisible({ timeout: 2_000 }).catch(() => false)) await guest.click()
  await page.waitForTimeout(500)
}

async function sessions(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return raw ? (JSON.parse(raw).state.days[iso]?.deepWorkSessions ?? []) : []
  }, STATE_KEY)
}

async function persistedBlock(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as { status: string }) : null
  }, BLOCK_KEY)
}

/** WCAG contrast of an element's text against its own background. */
async function textContrast(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const parse = (c: string) => c.match(/[\d.]+/g)!.map(Number)
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    const bgRaw = parse(cs.backgroundColor)
    const [l1, l2] = [lum(fg), lum(bgRaw)].sort((a, b) => b - a)
    return {
      ratio: (l1 + 0.05) / (l2 + 0.05),
      bgAlpha: bgRaw.length > 3 ? bgRaw[3] : 1,
      fgAlpha: fg.length > 3 ? fg[3] : 1,
      border: cs.borderTopWidth,
      opacity: cs.opacity,
    }
  })
}

test.describe('Desktop Focus: Exit focus', () => {
  test('a visible button exits, the block keeps running, and Back to focus returns', async ({ page }) => {
    await seed(page, 'running')
    await open(page)

    const focus = page.getByTestId('focus-mode')
    await expect(focus).toBeVisible()
    const exit = focus.getByRole('button', { name: 'Exit focus' })
    await expect(exit).toBeVisible()
    await expect(focus.getByRole('button', { name: 'Leave focus' })).toHaveCount(0)

    // Reads as a button at rest: a border, an opaque fill, full-contrast text.
    const look = await textContrast(page, '[data-testid="focus-mode"] >> role=button[name="Exit focus"]')
    expect(look.border, 'Exit focus has no visible border').not.toBe('0px')
    expect(look.bgAlpha, 'Exit focus has no fill').toBe(1)
    expect(look.fgAlpha, 'Exit focus text is faded').toBe(1)
    expect(look.opacity).toBe('1')
    expect(look.ratio, `Exit focus contrast ${look.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)

    // Top-left, where the old link was.
    const box = (await exit.boundingBox())!
    const vp = page.viewportSize()!
    expect(box.x, 'Exit focus is not at the left').toBeLessThan(vp.width * 0.25)
    expect(box.y, 'Exit focus is not at the top').toBeLessThan(vp.height * 0.2)
    expect(box.height).toBeGreaterThanOrEqual(44)

    const before = await sessions(page)
    await exit.click()
    await expect(focus).toHaveCount(0)

    // The planner is back and the sidebar countdown is still going.
    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Deep work timer' }) })
    await expect(card).toBeVisible()
    await expect(card.getByText('running', { exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Pause' })).toBeVisible()
    const clock = card.locator('p.font-mono')
    const first = await clock.textContent()
    await expect.poll(() => clock.textContent(), { timeout: 4_000 }).not.toBe(first)
    expect(await sessions(page)).toEqual(before)
    expect((await persistedBlock(page))?.status).toBe('running')

    // Back to focus brings the screen back, with the block untouched.
    const back = card.getByRole('button', { name: 'Back to focus' })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page.getByTestId('focus-mode')).toBeVisible()
    expect((await persistedBlock(page))?.status).toBe('running')
    expect(await sessions(page)).toEqual(before)
  })

  test('a paused block stays paused after Exit focus', async ({ page }) => {
    await seed(page, 'paused')
    await open(page)

    const focus = page.getByTestId('focus-mode')
    await expect(focus).toBeVisible()
    await expect(focus.getByRole('button', { name: 'Resume' })).toBeVisible()
    const before = await sessions(page)

    await focus.getByRole('button', { name: 'Exit focus' }).click()
    await expect(focus).toHaveCount(0)

    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Deep work timer' }) })
    await expect(card.getByText('paused', { exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Resume' })).toBeVisible()
    const clock = card.locator('p.font-mono')
    const first = await clock.textContent()
    await page.waitForTimeout(1_500)
    expect(await clock.textContent(), 'a paused block counted down after Exit focus').toBe(first)
    expect((await persistedBlock(page))?.status).toBe('paused')
    expect(await sessions(page)).toEqual(before)
    await expect(card.getByRole('button', { name: 'Back to focus' })).toBeVisible()
  })

  test('Esc cancels the discard question first, then leaves', async ({ page }) => {
    await seed(page, 'running')
    await open(page)

    const focus = page.getByTestId('focus-mode')
    await expect(focus).toBeVisible()
    await expect(focus).toContainText('Exit focus or press Esc to bring them back.')

    await focus.getByRole('button', { name: 'Discard this block and start over' }).click()
    await expect(focus.getByRole('button', { name: 'Discard', exact: true })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(focus).toBeVisible()
    await expect(focus.getByRole('button', { name: 'Discard', exact: true })).toHaveCount(0)

    const before = await sessions(page)
    await page.keyboard.press('Escape')
    await expect(focus).toHaveCount(0)
    expect((await persistedBlock(page))?.status).toBe('running')
    expect(await sessions(page)).toEqual(before)
  })

  test('Back to focus is absent when no block is running', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('deepblock_guest_session', '1')
      localStorage.setItem('deepblock_tour_done', '1')
    })
    await open(page)
    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Deep work timer' }) })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: 'Start', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to focus' })).toHaveCount(0)
    await expect(page.getByTestId('focus-mode')).toHaveCount(0)
  })
})

test.describe('Phone Focus: Exit focus', () => {
  test.use(PHONE)

  test('Exit focus is thumb-sized, away from the block controls, and goes to Today', async ({ page }) => {
    await seed(page, 'running')
    await page.goto('/?tab=focus')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(500)

    const running = page.getByTestId('mobile-focus-running')
    await expect(running).toBeVisible()
    const exit = running.getByRole('button', { name: 'Exit focus' })
    await expect(exit).toBeVisible()

    // At least 44x44 and on screen without scrolling.
    const box = (await exit.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(PHONE.viewport.height)

    // Well clear of Discard, Pause and Finish early: a thumb going for those
    // is at least a ring's height away.
    for (const name of [
      'Discard this block and start over',
      'Pause block',
      'Finish early and keep the minutes worked',
    ]) {
      const control = (await running.getByRole('button', { name }).boundingBox())!
      const gap = control.y - (box.y + box.height)
      expect(gap, `Exit focus is ${gap}px from "${name}"`).toBeGreaterThanOrEqual(200)
    }

    const before = await sessions(page)
    await exit.click()

    await expect(running).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
    await expect(page.getByTestId('mobile-tab-bar').getByRole('button', { name: /Today/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect((await persistedBlock(page))?.status).toBe('running')
    expect(await sessions(page)).toEqual(before)

    // The block is still live when you come back.
    await page.getByTestId('mobile-tab-bar').getByRole('button', { name: /Focus/ }).click()
    await expect(page.getByTestId('mobile-focus-running')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause block' })).toBeVisible()
  })
})
