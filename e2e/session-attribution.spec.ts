/**
 * e2e/session-attribution.spec.ts
 *
 * A block recorded against the wrong task can be moved to the right one.
 *
 * Picking the wrong task in "Working on" takes a second and used to be
 * permanent: the only thing that touched a session's task was deleting the
 * task, so the remedy for a mislabelled record was to destroy the label. The
 * minutes must survive the move exactly as recorded - that is the whole point
 * of allowing it.
 *
 * Seed (today): two High Priority tasks of 3h, and one earned 45m block
 * attributed to the first.
 */

import { test, expect, type Page } from '@playwright/test'

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
  return page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    if (!window.sessionStorage.getItem('_pw_attr_ready')) {
      window.sessionStorage.setItem('_pw_attr_ready', '1')
      try {
        const today = new Date().toISOString().slice(0, 10)
        const mk = (id: string, title: string) => ({
          id,
          title,
          sectionId: 'highPriority',
          date: today,
          isDone: false,
          durationMinutes: 180,
        })
        const appState = {
          days: {
            [today]: {
              date: today,
              tasks: [mk('pw-wrong', 'Wrong task'), mk('pw-right', 'Right task')],
              habitCompletions: {},
              deepWorkSessions: [
                {
                  id: 'pw-session-1',
                  label: 'Morning block',
                  durationMinutes: 45,
                  taskId: 'pw-wrong',
                  startedAt: `${today}T09:00:00.000Z`,
                  finishedAt: `${today}T09:45:00.000Z`,
                },
              ],
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
  })
}

async function expandHighPriority(page: Page) {
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'High Priority (Focus Tasks)' }) })
    .first()
  const expand = section.getByRole('button', { name: 'Expand section' })
  if (await expand.count()) await expand.click()
  await expect(section.getByRole('checkbox').first()).toBeVisible()
}

/** The progress totals, in the seeded task order: wrong task, then right task. */
function totals(page: Page) {
  return page.getByRole('button', { name: /logged.*Log time by hand/i })
}

async function readDay(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('deepblock_state_v1')
    const state = JSON.parse(raw!).state
    return state.days[Object.keys(state.days)[0]!]
  })
}

test('a block recorded against the wrong task can be moved to the right one', async ({ page }) => {
  await seed(page)
  await openPlanner(page)
  await dismissModals(page)
  await expandHighPriority(page)

  await expect(totals(page).nth(0)).toHaveText('45m/3h')
  await expect(totals(page).nth(1)).toHaveText('0m/3h')

  await totals(page).nth(0).click()
  const sheet = page.getByRole('dialog', { name: /Log time on Wrong task/i })
  await expect(sheet).toBeVisible()

  await sheet.getByRole('button', { name: /Worked against the wrong task/i }).click()
  const picker = sheet.getByRole('combobox', { name: /Move 45m to another task/i })
  await expect(picker).toBeVisible()
  await picker.selectOption({ label: 'Right task' })

  // The minutes move; they are not re-earned, re-timed, or rounded on the way.
  const day = await readDay(page)
  expect(day.deepWorkSessions).toHaveLength(1)
  expect(day.deepWorkSessions[0]).toMatchObject({
    id: 'pw-session-1',
    taskId: 'pw-right',
    durationMinutes: 45,
    label: 'Morning block',
  })

  await page.getByRole('button', { name: 'Close' }).first().click()
  await expect(totals(page).nth(0)).toHaveText('0m/3h')
  await expect(totals(page).nth(1)).toHaveText('45m/3h')
})
