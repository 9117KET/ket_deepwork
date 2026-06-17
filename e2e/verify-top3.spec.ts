/**
 * e2e/verify-top3.spec.ts
 *
 * Regression guard for the "Top 3" relabel (formerly "MUSTs") and the
 * copy-today's-top-3-to-tomorrow feature. Drives the planner in guest mode and
 * asserts the user-facing labels plus the copy-forward behaviour.
 */
import { test, expect, type Page } from '@playwright/test'

async function injectGuestState(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
    const today = new Date().toISOString().slice(0, 10)
    const appState = {
      days: { [today]: { date: today, tasks: [], habitCompletions: {}, deepWorkSessions: [], wakeTime: '07:00', sleepTarget: '23:00', bedTime: '22:30' } },
    }
    window.localStorage.setItem('deepblock_state_v1', JSON.stringify({ version: 1, state: appState }))
  })
}

async function openPlannerAsGuest(page: Page) {
  await page.goto('/planner')
  await page.waitForFunction(() => {
    if (document.querySelector('[data-tour="date-nav"]')) return true
    const guest = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Continue as guest')
    if (guest) { (guest as HTMLButtonElement).click(); return false }
    return false
  }, { timeout: 40_000, polling: 400 })
  const skip = page.getByRole('button', { name: 'Skip for today' })
  if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) await skip.click()
}

test('Top 3 labels render in the planner', async ({ page }) => {
  await injectGuestState(page)
  await openPlannerAsGuest(page)

  // 1. Pinned header label + empty state (0 tasks)
  await expect(page.getByText('Your top 3 for today').first()).toBeVisible()
  await expect(page.getByText(/No priorities set/).first()).toBeVisible()
  console.log('HEADER+EMPTY OK:', await page.getByText('Your top 3 for today').first().textContent(),
    '|', await page.getByText(/No priorities set/).first().textContent())
  await page.screenshot({ path: 'test-results/verify-top3-header.png', fullPage: true })

  // 2. Add a top-3 task → "Duration" dropdown should render on the row
  const addBtn = page.getByText('+ Add').first()
  if (await addBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await addBtn.click()
  const input = page.getByPlaceholder('Add a top priority for today…').first()
  await input.fill('Ship the release')
  await input.press('Enter')
  await expect(page.getByText('Ship the release').first()).toBeVisible()
  const durationOptions = await page.locator('select option', { hasText: 'Duration' }).allTextContents()
  console.log('DURATION OPTION(S):', JSON.stringify(durationOptions))
  expect(durationOptions.length).toBeGreaterThan(0)

  // 3. Tomorrow panel labels — scroll to Night Routine, open the panel
  const panelHeader = page.getByText('Plan tomorrow\'s top 3').first()
  await panelHeader.scrollIntoViewIfNeeded()
  await expect(panelHeader).toBeVisible()
  await panelHeader.click()
  const copyBtn = page.getByRole('button', { name: /Copy today's top 3/ })
  await expect(copyBtn).toBeVisible()
  console.log('TOMORROW PANEL OK:', await panelHeader.textContent(), '|', await copyBtn.textContent())
  await page.screenshot({ path: 'test-results/verify-top3-tomorrow.png', fullPage: true })

  // 4. 🔍 Probe: the copy button actually carries today's task into tomorrow
  await copyBtn.click()
  await expect(page.getByText('Ship the release')).toHaveCount(2) // today's row + tomorrow's copy
  console.log('COPY PROBE OK: task present in both today and tomorrow')
})
