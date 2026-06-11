/**
 * e2e/copy-from-day.spec.ts
 *
 * Verifies that "Fill from yesterday" copies tasks INCLUDING their scheduled
 * times (scheduledAt) and durations (durationMinutes), so the user doesn't
 * have to re-enter hours after copying a day.
 */

import { test, expect, type Page } from '@playwright/test'

interface SeededTask {
  id: string
  title: string
  sectionId: string
  date: string
  isDone: boolean
  scheduledAt?: string
  durationMinutes?: number
}

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

async function dismissDaySetupIfPresent(page: Page) {
  const skipBtn = page.getByRole('button', { name: 'Skip for today' })
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click()
  }
  // Close the ShutdownRitualModal if it auto-opened (time-based trigger in evenings)
  const closeModal = page.getByRole('button', { name: 'Close', exact: true })
  if (await closeModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeModal.click()
    await page.waitForTimeout(300)
  }
}

/** Seed yesterday with timed tasks and leave today empty so the fill buttons render. */
async function prepareCopyTest(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    if (!window.sessionStorage.getItem('_pw_copy_ready')) {
      window.sessionStorage.setItem('_pw_copy_ready', '1')
      try {
        const today = new Date().toISOString().slice(0, 10)
        const yDate = new Date()
        yDate.setDate(yDate.getDate() - 1)
        const yesterday = yDate.toISOString().slice(0, 10)

        const raw = window.localStorage.getItem('deepblock_state_v1')
        let appState: Record<string, unknown> = { days: {} }
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.version === 1 && parsed.state) appState = parsed.state
        }
        const days = (appState.days as Record<string, unknown>) ?? {}
        days[yesterday] = {
          date: yesterday,
          habitCompletions: {},
          deepWorkSessions: [],
          tasks: [
            {
              id: 'pw-copy-src-1', title: 'Deep work block', sectionId: 'highPriority',
              date: yesterday, isDone: false, scheduledAt: '09:00', durationMinutes: 90,
            },
            {
              id: 'pw-copy-src-2', title: 'Email sweep', sectionId: 'lowPriority',
              date: yesterday, isDone: true, scheduledAt: '16:30', durationMinutes: 30,
            },
          ],
        }
        days[today] = {
          date: today, tasks: [], habitCompletions: {}, deepWorkSessions: [],
          wakeTime: '07:00', sleepTarget: '23:00', bedTime: '22:30',
          // Mark shutdown complete so the ShutdownRitualModal doesn't auto-open
          shutdownCompletedAt: new Date().toISOString(),
        }
        appState.days = days
        window.localStorage.setItem('deepblock_state_v1', JSON.stringify({ version: 1, state: appState }))
      } catch (_) { /* ignore */ }
    }
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
  })
}

function readTodayTasks(page: Page): Promise<SeededTask[]> {
  return page.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10)
    const raw = window.localStorage.getItem('deepblock_state_v1')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed?.state?.days?.[today]?.tasks ?? []
  })
}

test.describe('Fill from yesterday — copies scheduled times and durations', () => {
  test.beforeEach(async ({ page }) => {
    await prepareCopyTest(page)
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
  })

  test('copied tasks keep scheduledAt and durationMinutes and reset isDone', async ({ page }) => {
    const fillBtn = page.getByRole('button', { name: 'Fill from yesterday' })
    await expect(fillBtn).toBeVisible({ timeout: 8_000 })
    await fillBtn.click()

    await expect
      .poll(async () => (await readTodayTasks(page)).length, { timeout: 6_000 })
      .toBeGreaterThan(0)

    const tasks = await readTodayTasks(page)
    const deepWork = tasks.find(t => t.title === 'Deep work block')
    const email = tasks.find(t => t.title === 'Email sweep')

    expect(deepWork).toBeTruthy()
    expect(deepWork?.scheduledAt).toBe('09:00')
    expect(deepWork?.durationMinutes).toBe(90)
    expect(deepWork?.isDone).toBe(false)
    // New IDs are generated for the copies
    expect(deepWork?.id).not.toBe('pw-copy-src-1')

    expect(email).toBeTruthy()
    expect(email?.scheduledAt).toBe('16:30')
    expect(email?.durationMinutes).toBe(30)
    // Completed source tasks are copied as not-done
    expect(email?.isDone).toBe(false)
  })
})
