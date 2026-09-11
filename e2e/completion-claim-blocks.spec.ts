/**
 * e2e/completion-claim-blocks.spec.ts
 *
 * Ticking a task off with empty blocks asks how many of them the work actually
 * took, and logs exactly that.
 *
 * The case that matters is finishing early: eight blocks set aside, two
 * actually worked. Before the picker the only answers were "log all eight" or
 * "log nothing", and the second is what people pick, which is how a day of real
 * work ends up with no record of itself.
 *
 * Seed (today): one High Priority task of 6h = 8 blocks at the default 45m.
 */

import { test, expect, type Page } from '@playwright/test'

const BLOCK = 45
const BLOCKS = 8

async function openPlanner(page: Page) {
  await page.goto('/planner')
  await page.waitForFunction(
    () => {
      if (document.querySelector('[data-tour="date-nav"]')) return true
      const btns = Array.from(document.querySelectorAll('button'))
      const guest = btns.find((b) => b.textContent?.trim() === 'Continue as guest')
      if (guest) (guest as HTMLButtonElement).click()
      return false
    },
    { timeout: 40_000, polling: 400 },
  )
}

async function dismissModals(page: Page) {
  const skipBtn = page.getByRole('button', { name: 'Skip for today' })
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await skipBtn.click()
  const closeModal = page.getByRole('button', { name: 'Close', exact: true })
  if (await closeModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeModal.click()
    await page.waitForTimeout(300)
  }
}

function seed(page: Page) {
  return page.addInitScript((minutes: number) => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    if (!window.sessionStorage.getItem('_pw_claim_ready')) {
      window.sessionStorage.setItem('_pw_claim_ready', '1')
      try {
        const today = new Date().toISOString().slice(0, 10)
        const appState = {
          days: {
            [today]: {
              date: today,
              tasks: [
                {
                  id: 'pw-claim-1',
                  title: 'Write the dissertation chapter',
                  sectionId: 'highPriority',
                  date: today,
                  isDone: false,
                  durationMinutes: minutes,
                },
              ],
              habitCompletions: {},
              deepWorkSessions: [],
              wakeTime: '07:00',
              sleepTarget: '23:00',
              shutdownCompletedAt: new Date().toISOString(),
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
    {
      const d = new Date()
      const localIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      window.sessionStorage.setItem(`shutdown_reminder_shown_${localIso}`, '1')
    }
  }, BLOCK * BLOCKS)
}

/** Sections start collapsed in the redesign; open the one holding the task. */
async function expandHighPriority(page: Page) {
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'High Priority (Focus Tasks)' }) })
    .first()
  const expand = section.getByRole('button', { name: 'Expand section' })
  if (await expand.count()) await expand.click()
  await expect(section.getByRole('checkbox').first()).toBeVisible()
}

/** The planner state as the app would reload it. */
async function readDay(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('deepblock_state_v1')
    if (!raw) return null
    const state = JSON.parse(raw).state
    const today = Object.keys(state.days)[0]!
    return state.days[today]
  })
}

/** The running total on the task's progress row, e.g. "1h30/6h". */
function progressTotal(page: Page) {
  return page.getByRole('button', { name: /logged.*Log time by hand/i }).first()
}

test.describe('Completing a task asks how many of its blocks were done', () => {
  test('logs only the blocks picked, not the whole remainder', async ({ page }) => {
    await seed(page)
    await openPlanner(page)
    await dismissModals(page)

    await expandHighPriority(page)
    await expect(progressTotal(page)).toHaveText('0m/6h')

    // Tick it off - the question is asked at the moment of completion.
    await page.getByRole('checkbox', { name: /Write the dissertation chapter/i }).first().click()

    const prompt = page.getByRole('radiogroup', {
      name: /How many blocks of Write the dissertation chapter/i,
    })
    await expect(prompt).toBeVisible()
    // One option per empty block, and it opens on all of them.
    await expect(prompt.getByRole('radio')).toHaveCount(BLOCKS)
    await expect(page.getByRole('button', { name: 'Log 6h by hand' })).toBeVisible()

    // "I only needed two of the eight."
    await prompt.getByRole('radio', { name: '2', exact: true }).click()
    await page.getByRole('button', { name: 'Log 1h30 by hand' }).click()

    await expect(progressTotal(page)).toHaveText('1h30/6h')

    // What got written matters as much as what got drawn: hand-logged time is
    // an entry on the day, marked as self-reported, not a number on the task.
    const day = await readDay(page)
    expect(day.tasks[0].manualLoggedMinutes).toBeUndefined()
    const manual = day.deepWorkSessions.filter((s: { source?: string }) => s.source === 'manual')
    expect(manual).toHaveLength(1)
    expect(manual[0]).toMatchObject({ durationMinutes: 90, taskId: 'pw-claim-1', source: 'manual' })
    expect(manual[0].loggedAt).toBeTruthy()
    // No interval was given, so none was invented.
    expect(manual[0].finishedAt).toBeUndefined()
  })

  test('declining logs nothing', async ({ page }) => {
    await seed(page)
    await openPlanner(page)
    await dismissModals(page)
    await expandHighPriority(page)

    await page.getByRole('checkbox', { name: /Write the dissertation chapter/i }).first().click()
    await page.getByRole('button', { name: 'None' }).click()

    await expect(progressTotal(page)).toHaveText('0m/6h')
  })
})
