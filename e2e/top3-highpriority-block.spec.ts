/**
 * e2e/top3-highpriority-block.spec.ts
 *
 * Verifies that the total duration allocated to today's Top 3 (mustDo) tasks is
 * folded into the High Priority block's time window, pushing the later blocks
 * later. The Top 3 tasks themselves stay in the pinned header — only their
 * duration is counted against the high-priority window.
 *
 * Seed (today): wake 07:00, explicit block durations
 *   morningRoutine 60 -> 07:00-08:00
 *   highPriority  120 -> 08:00-10:00 (base, before Top 3)
 * Top 3 durations: 60 + 30 = 90  =>  highPriority window 08:00-11:30
 *   medium/low/night therefore shift 90 min later (medium starts 11:30).
 */

import { test, expect, type Page } from '@playwright/test'

async function openPlanner(page: Page) {
  await page.goto('/planner')
  await page.waitForFunction(
    () => {
      if (document.querySelector('[data-tour="date-nav"]')) return true
      const btns = Array.from(document.querySelectorAll('button'))
      const guest = btns.find(b => b.textContent?.trim() === 'Continue as guest')
      if (guest) (guest as HTMLButtonElement).click()
      return false
    },
    { timeout: 40_000, polling: 400 },
  )
}

async function dismissModals(page: Page) {
  const skipBtn = page.getByRole('button', { name: 'Skip for today' })
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click()
  }
  const closeModal = page.getByRole('button', { name: 'Close', exact: true })
  if (await closeModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeModal.click()
    await page.waitForTimeout(300)
  }
}

function seed(page: Page, top3Durations: number[]) {
  return page.addInitScript((durations: number[]) => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    if (!window.sessionStorage.getItem('_pw_top3_ready')) {
      window.sessionStorage.setItem('_pw_top3_ready', '1')
      try {
        const today = new Date().toISOString().slice(0, 10)
        const mustDoTasks = durations.map((min, i) => ({
          id: `pw-top3-${i}`,
          title: `Top priority ${i + 1}`,
          sectionId: 'mustDo',
          date: today,
          isDone: false,
          durationMinutes: min,
        }))
        const appState = {
          days: {
            [today]: {
              date: today,
              tasks: mustDoTasks,
              habitCompletions: {},
              deepWorkSessions: [],
              wakeTime: '07:00',
              sleepTarget: '23:00',
              bedTime: '22:30',
              shutdownCompletedAt: new Date().toISOString(),
              blockDurations: {
                morningRoutine: 60,
                highPriority: 120,
                mediumPriority: 60,
                lowPriority: 60,
                nightRoutine: 60,
              },
            },
          },
        }
        window.localStorage.setItem(
          'deepblock_state_v1',
          JSON.stringify({ version: 1, state: appState }),
        )
      } catch (_) { /* ignore */ }
    }
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
  }, top3Durations)
}

/** Text of the timeframe label paragraph under a section heading. */
function sectionLabel(page: Page, heading: string) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: heading }) })
    .first()
    .locator('p')
    .first()
}

test.describe('Top 3 duration folds into the High Priority block window', () => {
  test('high priority window extends by the Top 3 total; later blocks shift', async ({ page }) => {
    await seed(page, [60, 30]) // 90 min of Top 3 work
    await openPlanner(page)
    await dismissModals(page)

    const high = sectionLabel(page, 'High Priority (Focus Tasks)')
    // Base 08:00-10:00 + 90 min Top 3 => 08:00-11:30
    await expect(high).toContainText('8 AM - 11:30 AM', { timeout: 10_000 })
    // Note shows how much of the window is reserved for the Top 3
    await expect(high).toContainText('+1h30m Top Three')

    // Medium block shifted 90 min later: was 10:00-11:00, now 11:30-12:30
    const medium = sectionLabel(page, 'Medium Priority (Supplementary Tasks)')
    await expect(medium).toContainText('11:30 AM - 12:30 PM')
  })

  test('with no Top 3 durations the window is unchanged', async ({ page }) => {
    await seed(page, []) // no Top 3 work
    await openPlanner(page)
    await dismissModals(page)

    const high = sectionLabel(page, 'High Priority (Focus Tasks)')
    // Base window only: 08:00-10:00
    await expect(high).toContainText('8 AM - 10 AM', { timeout: 10_000 })
    // No Top 3 durations => no reserved-time note
    await expect(high).not.toContainText('Top 3')
  })
})
