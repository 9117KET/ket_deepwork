/**
 * e2e/review-voice-collapse.spec.ts
 *
 * Tests for:
 *   1. Review cards default to collapsed state
 *   2. Mic buttons present in ShutdownRitualModal, WeeklyReviewCard, MonthlyReviewCard
 *   3. ReviewReminderModal appears when a review is due and can be dismissed
 *   4. Close day button opens the ShutdownRitualModal
 *
 * Note: The Web Speech API (used by AudioTextarea) is not available in headless
 * Chromium. Tests verify the mic button renders, not that speech recognition works.
 * Mic buttons return null on unsupported browsers, so tests guard with isVisible checks.
 */

import { test, expect, type Page } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

/** Baseline init script: skip tour, set today's day data, dismiss reminder popups. */
async function prepareBase(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    if (!window.sessionStorage.getItem('_pw_vc_ready')) {
      window.sessionStorage.setItem('_pw_vc_ready', '1')
      try {
        const today = new Date().toISOString().slice(0, 10)
        const raw = window.localStorage.getItem('deepblock_state_v1')
        let appState: Record<string, unknown> = { days: {} }
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.version === 1 && parsed.state) appState = parsed.state
        }
        const days = (appState.days as Record<string, unknown>) ?? {}
        const existing = (days[today] as Record<string, unknown>) ?? {}
        days[today] = {
          tasks: [], habitCompletions: {}, deepWorkSessions: [],
          ...existing, date: today,
          wakeTime: '07:00', sleepTarget: '23:00', bedTime: '22:30',
        }
        appState.days = days
        delete appState.monthlyReviews
        delete (appState as Record<string, unknown>).weeklyReviews
        window.localStorage.setItem('deepblock_state_v1', JSON.stringify({ version: 1, state: appState }))
      } catch (_) { /* ignore */ }
    }
    // Keep review reminders dismissed by default for non-reminder tests
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
  })
}

async function dismissDaySetupIfPresent(page: Page) {
  const skipBtn = page.getByRole('button', { name: 'Skip for today' })
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click()
  }
}

async function scrollToTrackingDashboard(page: Page) {
  await page.evaluate(() => {
    document.getElementById('tracking-dashboard')?.scrollIntoView({ behavior: 'instant' })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite A — Default collapsed state
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Review cards — default collapsed state', () => {
  test.beforeEach(async ({ page }) => {
    await prepareBase(page)
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
    await scrollToTrackingDashboard(page)
  })

  test('WeeklyReviewCard header is present and starts collapsed', async ({ page }) => {
    const header = page.getByRole('button').filter({ hasText: 'Weekly Review' })
    await expect(header.first()).toBeVisible({ timeout: 6_000 })
    // aria-expanded=false means collapsed
    await expect(header.first()).toHaveAttribute('aria-expanded', 'false')
  })

  test('MonthlyReviewCard header is present and starts collapsed', async ({ page }) => {
    const header = page.getByRole('button').filter({ hasText: 'Monthly Review' })
    await expect(header.first()).toBeVisible({ timeout: 6_000 })
    await expect(header.first()).toHaveAttribute('aria-expanded', 'false')
  })

  test('WeeklyReviewCard expands when header is clicked', async ({ page }) => {
    const header = page.getByRole('button').filter({ hasText: 'Weekly Review' })
    await header.first().click()
    await expect(header.first()).toHaveAttribute('aria-expanded', 'true')
    // At least one textarea visible after expanding
    const weeklySection = page.locator('.mt-3.rounded.border.border-sky-900\\/40')
    await expect(weeklySection.locator('textarea').first()).toBeVisible({ timeout: 4_000 })
  })

  test('MonthlyReviewCard expands when header is clicked', async ({ page }) => {
    const header = page.getByRole('button').filter({ hasText: 'Monthly Review' })
    await header.first().click()
    await expect(header.first()).toHaveAttribute('aria-expanded', 'true')
    const monthlySection = page.locator('.mt-3.rounded.border.border-amber-900\\/40')
    await expect(monthlySection.locator('textarea').first()).toBeVisible({ timeout: 4_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite B — Mic buttons in review cards
// (Web Speech API unavailable in headless Chromium — button absent is fine)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Review cards — voice recording buttons', () => {
  test.beforeEach(async ({ page }) => {
    await prepareBase(page)
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
    await scrollToTrackingDashboard(page)
  })

  test('WeeklyReviewCard shows voice button or gracefully omits it (no crash)', async ({ page }) => {
    // Expand the card
    const header = page.getByRole('button').filter({ hasText: 'Weekly Review' })
    await header.first().click()

    // Page must still be alive
    await expect(header.first()).toHaveAttribute('aria-expanded', 'true')

    // If mic is available, button shows; if not, it's absent — both are valid
    const micBtn = page.getByRole('button', { name: /voice input|recording/i }).first()
    const isMicVisible = await micBtn.isVisible({ timeout: 1_000 }).catch(() => false)
    if (isMicVisible) {
      // Button should not be disabled
      await expect(micBtn).toBeEnabled()
    }
  })

  test('MonthlyReviewCard shows voice button or gracefully omits it (no crash)', async ({ page }) => {
    const header = page.getByRole('button').filter({ hasText: 'Monthly Review' })
    await header.first().click()

    await expect(header.first()).toHaveAttribute('aria-expanded', 'true')

    const micBtn = page.getByRole('button', { name: /voice input|recording/i }).first()
    const isMicVisible = await micBtn.isVisible({ timeout: 1_000 }).catch(() => false)
    if (isMicVisible) {
      await expect(micBtn).toBeEnabled()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite C — Close day button opens ShutdownRitualModal
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Close day — ShutdownRitualModal', () => {
  test.beforeEach(async ({ page }) => {
    await prepareBase(page)
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
  })

  test('Close day button opens the shutdown modal with journal step', async ({ page }) => {
    // The "Close day" button uses a moon icon; find by accessible name or text
    const closeDayBtn = page.getByRole('button', { name: /close day/i })
    await expect(closeDayBtn.first()).toBeVisible({ timeout: 8_000 })
    await closeDayBtn.first().click()

    // Modal header should show step 1 ("How did today actually go?")
    await expect(page.getByText('How did today actually go?')).toBeVisible({ timeout: 4_000 })
    // Step indicator
    await expect(page.getByText('1 of 3')).toBeVisible()
  })

  test('ShutdownRitualModal has voice button or gracefully omits it (no crash)', async ({ page }) => {
    const closeDayBtn = page.getByRole('button', { name: /close day/i })
    await closeDayBtn.first().click()

    await expect(page.getByText('How did today actually go?')).toBeVisible({ timeout: 4_000 })

    // Mic button may or may not be present depending on browser support
    const micBtn = page.getByRole('button', { name: /voice input|recording/i }).first()
    const isMicVisible = await micBtn.isVisible({ timeout: 1_000 }).catch(() => false)
    if (isMicVisible) {
      await expect(micBtn).toBeEnabled()
    }

    // The textarea/audio area for the journal note must be present
    await expect(page.locator('textarea').first()).toBeVisible()
  })

  test('ShutdownRitualModal can be typed into and advances to step 2', async ({ page }) => {
    const closeDayBtn = page.getByRole('button', { name: /close day/i })
    await closeDayBtn.first().click()
    await expect(page.getByText('1 of 3')).toBeVisible({ timeout: 4_000 })

    // Type a journal note
    await page.locator('textarea').first().fill('Day went well. Deep work session protected.')

    // Click the modal's Next button (scope to the overlay to avoid ambiguity with day-nav)
    await page.locator('.fixed.inset-0.z-50').getByRole('button', { name: /next/i }).click()
    await expect(page.getByText('2 of 3')).toBeVisible({ timeout: 4_000 })
  })

  test('ShutdownRitualModal can be closed with the Close button', async ({ page }) => {
    const closeDayBtn = page.getByRole('button', { name: /close day/i })
    await closeDayBtn.first().click()
    await expect(page.getByText('How did today actually go?')).toBeVisible({ timeout: 4_000 })

    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByText('How did today actually go?')).not.toBeVisible({ timeout: 4_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite D — ReviewReminderModal
// ─────────────────────────────────────────────────────────────────────────────

test.describe('ReviewReminderModal — monthly review due (last 3 days of month)', () => {
  test.beforeEach(async ({ page }) => {
    // Do NOT pre-dismiss the monthly reminder — we want it to appear
    await page.addInitScript(() => {
      window.localStorage.setItem('deepblock_tour_done', '1')
      if (!window.sessionStorage.getItem('_pw_reminder_ready')) {
        window.sessionStorage.setItem('_pw_reminder_ready', '1')
        try {
          const today = new Date().toISOString().slice(0, 10)
          const raw = window.localStorage.getItem('deepblock_state_v1')
          let appState: Record<string, unknown> = { days: {} }
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.version === 1 && parsed.state) appState = parsed.state
          }
          const days = (appState.days as Record<string, unknown>) ?? {}
          const existing = (days[today] as Record<string, unknown>) ?? {}
          days[today] = {
            tasks: [], habitCompletions: {}, deepWorkSessions: [],
            ...existing, date: today,
            wakeTime: '07:00', sleepTarget: '23:00', bedTime: '22:30',
          }
          appState.days = days
          delete appState.monthlyReviews
          window.localStorage.setItem('deepblock_state_v1', JSON.stringify({ version: 1, state: appState }))
        } catch (_) { /* ignore */ }
      }
      // Dismiss weekly but NOT monthly so the monthly reminder fires
      window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
      window.sessionStorage.removeItem('review_reminder_dismissed_monthly')
    })
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
    await scrollToTrackingDashboard(page)
  })

  test('monthly reminder modal appears when monthly review is due (last 3 days) and not dismissed', async ({ page }) => {
    // This only passes when today is in the last 3 days of the month.
    // Skip otherwise to avoid false failures on unrelated days.
    const isDue = await page.evaluate(() => {
      const today = new Date()
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      return today.getDate() >= lastDay - 2
    })
    if (!isDue) {
      test.skip()
      return
    }

    await expect(page.getByText('Monthly Review Due')).toBeVisible({ timeout: 6_000 })
    await expect(page.getByRole('button', { name: 'Go to review →' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remind me later' })).toBeVisible()
  })

  test('"Remind me later" dismisses the modal and sets sessionStorage', async ({ page }) => {
    const isDue = await page.evaluate(() => {
      const today = new Date()
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      return today.getDate() >= lastDay - 2
    })
    if (!isDue) {
      test.skip()
      return
    }

    await expect(page.getByText('Monthly Review Due')).toBeVisible({ timeout: 6_000 })
    await page.getByRole('button', { name: 'Remind me later' }).click()

    // Modal should be gone
    await expect(page.getByText('Monthly Review Due')).not.toBeVisible({ timeout: 4_000 })

    // sessionStorage should have the dismiss key
    const dismissed = await page.evaluate(() =>
      sessionStorage.getItem('review_reminder_dismissed_monthly')
    )
    expect(dismissed).toBe('1')
  })

  test('"Go to review →" dismisses modal and expands the monthly review card', async ({ page }) => {
    const isDue = await page.evaluate(() => {
      const today = new Date()
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      return today.getDate() >= lastDay - 2
    })
    if (!isDue) {
      test.skip()
      return
    }

    await expect(page.getByText('Monthly Review Due')).toBeVisible({ timeout: 6_000 })
    await page.getByRole('button', { name: 'Go to review →' }).click()

    // Modal should be gone
    await expect(page.getByText('Monthly Review Due')).not.toBeVisible({ timeout: 4_000 })

    // Monthly review card should be expanded (textareas visible)
    await page.waitForTimeout(600) // allow scroll + expand
    const monthlySection = page.locator('.mt-3.rounded.border.border-amber-900\\/40')
    await expect(monthlySection.locator('textarea').first()).toBeVisible({ timeout: 6_000 })
  })
})
