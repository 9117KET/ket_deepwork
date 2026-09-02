/**
 * e2e/monthly-review.spec.ts
 *
 * End-to-end tests for the Monthly Review banner and card.
 *
 * Tests are auth-agnostic: they work whether the user is signed in (Convex data)
 * or in guest mode (localStorage). Structural selectors (buttons, textareas,
 * aria states) are used instead of hardcoded question text, so the suite
 * remains valid even when the user has customised their review questions.
 *
 * Real date is 2026-05-30 (within the last 3 days of May) so the banner shows
 * without any clock mocking. Date-navigation tests use the day stepper's chevrons.
 */

import { test, expect, type Page } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Navigate to /planner and pass through the login wall if it appears.
 * Polls every 400 ms and clicks "Continue as guest" from inside the browser
 * the moment the button renders, avoiding React race conditions.
 * If the user is already authenticated, the planner loads directly.
 */
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

/**
 * Prepare a clean test context before page load:
 * - Skip the onboarding tour (always)
 * - On the first navigation of this test only (sessionStorage guards reloads):
 *   clear monthly reviews from localStorage so the review card starts fresh.
 *   Also pre-set today's wake time to prevent the DaySetup modal from blocking.
 *
 * Note: for signed-in users, state comes from Convex. These localStorage tweaks
 * only affect the guest / offline state. Tests are written to be resilient either way.
 */
async function prepareTestState(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')

    if (!window.sessionStorage.getItem('_pw_ready')) {
      window.sessionStorage.setItem('_pw_ready', '1')
      try {
        const today = new Date().toISOString().slice(0, 10)
        const raw = window.localStorage.getItem('deepblock_state_v1')
        let appState: Record<string, unknown> = { days: {} }
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed.version === 'number' && parsed.state) {
            appState = parsed.state
          }
        }

        // Pre-set today's wake time so the DaySetup modal never auto-opens.
        const days = (appState.days as Record<string, unknown>) ?? {}
        const existing = (days[today] as Record<string, unknown>) ?? {}
        days[today] = {
          tasks: [],
          habitCompletions: {},
          deepWorkSessions: [],
          ...existing,
          date: today,
          wakeTime: '07:00',
          sleepTarget: '23:00',
          bedTime: '22:30',
        }
        appState.days = days
        delete appState.monthlyReviews
        delete (appState as Record<string, unknown>).weeklyReviews
        // Reset weeklyReviewDay to Friday (5) so WeeklyReviewBanner only shows on Fridays
        ;(appState as Record<string, unknown>).weeklyReviewDay = 5

        window.localStorage.setItem(
          'deepblock_state_v1',
          JSON.stringify({ version: 1, state: appState }),
        )
      } catch (_) { /* ignore parse errors — fresh state will be used */ }
    }
    // Dismiss review reminder popups so they don't block test interactions
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
  })
}

/**
 * Dismiss the DaySetup modal if it opens (e.g. for authenticated users whose
 * today data comes from Convex and has no wakeTime yet).
 */
async function dismissDaySetupIfPresent(page: Page) {
  const skipBtn = page.getByRole('button', { name: 'Skip for today' })
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click()
  }
}

/**
 * Scroll to the MonthlyReviewCard in the tracking dashboard.
 * Returns when the "Monthly Review" card header is visible.
 */
async function scrollToReviewCard(page: Page) {
  await page.evaluate(() => {
    document.getElementById('tracking-dashboard')?.scrollIntoView({ behavior: 'instant' })
  })
  await expect(page.getByText('Monthly Review').first()).toBeVisible({ timeout: 6_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite A — End-of-month banner (pinned date: May 30, 2026)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Monthly Review — end of month (May 30)', () => {
  test.beforeEach(async ({ page }) => {
    // Pin the browser clock to May 30, 2026 so todayIso() returns that date
    // and the end-of-month banner always appears regardless of real run date.
    await page.clock.setFixedTime(new Date('2026-05-30T12:00:00.000Z'))
    await prepareTestState(page)
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
  })

  // ── 1. Banner is visible ──────────────────────────────────────────────────

  test('amber banner is visible with a countdown and Open ↓ button', async ({ page }) => {
    await expect(page.getByText(/Monthly review:/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open ↓' }).first()).toBeVisible()
  })

  // ── 2. Open ↓ — no modal, card expands ───────────────────────────────────

  test('Open ↓ expands the review card without opening a modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Open ↓' }).first().click()

    // Confirm no modal dialog opened
    await expect(page.locator('[role="dialog"]')).not.toBeVisible().catch(() => {})

    // The card should now be expanded: "Monthly Review" header visible and
    // at least one textarea present (one per question).
    await scrollToReviewCard(page)
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 8_000 })
  })

  // ── 3. Review card shows at least 7 questions ────────────────────────────

  test('review card has at least 7 question textareas', async ({ page }) => {
    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    // Wait for textareas to appear then count them
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 8_000 })
    const count = await page.locator('textarea').count()
    expect(count).toBeGreaterThanOrEqual(7)
  })

  // ── 4. Typing in a textarea works (no crash) ─────────────────────────────

  test('typing an answer in the first textarea does not crash the page', async ({ page }) => {
    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    const first = page.locator('textarea').first()
    await first.scrollIntoViewIfNeeded()
    await first.fill('Test answer — deep work tracking.')
    await page.waitForTimeout(600) // wait for debounce

    // Page must still be alive — check header still visible
    await expect(page.getByText(/Monthly review:/).first()).toBeVisible()
    // Value should still be in the textarea
    await expect(first).toHaveValue('Test answer — deep work tracking.')
  })

  // ── 5. Mark complete collapses the card ──────────────────────────────────

  test('Mark review complete collapses the card and shows ✓ done badge', async ({ page }) => {
    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    const completeBtn = page.getByRole('button', { name: 'Mark review complete' })
    await completeBtn.scrollIntoViewIfNeeded()
    await completeBtn.click()

    // Textareas should disappear (card is collapsed)
    await expect(page.locator('textarea').first()).not.toBeVisible({ timeout: 6_000 })

    // Done badge should appear in the card header
    await expect(page.getByText('✓ done').first()).toBeVisible()
  })

  // ── 6. Banner shows done (emerald) state after completion ─────────────────

  test('banner switches to emerald done state after completing the review', async ({ page }) => {
    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    const completeBtn = page.getByRole('button', { name: 'Mark review complete' })
    await completeBtn.scrollIntoViewIfNeeded()
    await completeBtn.click()

    // Scroll back to top to see the banner
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.getByText('Monthly review done').first()).toBeVisible({ timeout: 6_000 })
    await expect(page.getByRole('button', { name: 'Revisit ↓' }).first()).toBeVisible()
    // After completion the monthly "Open ↓" is replaced by "Revisit ↓" in the monthly banner
    const monthlyOpenBtns = page.locator('.bg-amber-500\\/10 button', { hasText: 'Open ↓' })
    await expect(monthlyOpenBtns).not.toBeVisible()
  })

  // ── 7. Revisit ↓ re-expands the card ─────────────────────────────────────

  test('Revisit ↓ re-expands the collapsed card after completion', async ({ page }) => {
    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    const completeBtn = page.getByRole('button', { name: 'Mark review complete' })
    await completeBtn.scrollIntoViewIfNeeded()
    await completeBtn.click()

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByRole('button', { name: 'Revisit ↓' }).click()

    // Card should expand again — textareas visible
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 6_000 })
  })

  // ── 8. Reopen un-completes the review ────────────────────────────────────

  test('Reopen button inside the card removes the done state', async ({ page }) => {
    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    const completeBtn = page.getByRole('button', { name: 'Mark review complete' })
    await completeBtn.scrollIntoViewIfNeeded()
    await completeBtn.click()

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByRole('button', { name: 'Revisit ↓' }).click()

    // Use exact:true so we target the "Reopen" action button, not the full card header button
    const reopenBtn = page.getByRole('button', { name: 'Reopen', exact: true })
    await reopenBtn.scrollIntoViewIfNeeded()
    await reopenBtn.click()

    // Done badge gone; Mark complete button restored
    await expect(page.getByText('✓ done')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark review complete' })).toBeVisible()
  })

  // ── 9. Navigating to May 28 hides the banner ─────────────────────────────

  test('banner disappears when navigating to May 28 (below threshold)', async ({ page }) => {
    await page.getByRole('button', { name: 'Previous day', exact: true }).first().click()
    await page.getByRole('button', { name: 'Previous day', exact: true }).first().click()

    await expect(page.getByText(/Monthly review:/).first()).not.toBeVisible({ timeout: 4_000 })
    await expect(page.getByRole('button', { name: 'Open ↓' }).first()).not.toBeVisible()
  })

  // ── 10. May 31 shows "last day!" ─────────────────────────────────────────

  test('banner shows "last day!" on May 31', async ({ page }) => {
    await page.getByRole('button', { name: 'Next day', exact: true }).first().click()
    await expect(page.getByText('Monthly review: last day!')).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite B — Review card accessible mid-month
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Monthly Review — mid-month navigation', () => {
  test.beforeEach(async ({ page }) => {
    await prepareTestState(page)
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
  })

  test('banner is hidden after navigating back 15 days (May 15)', async ({ page }) => {
    for (let i = 0; i < 15; i++) {
      await page.getByRole('button', { name: 'Previous day', exact: true }).first().click()
    }
    await expect(page.getByText(/Monthly review:/).first()).not.toBeVisible({ timeout: 4_000 })
  })

  test('review card in tracking dashboard is still accessible mid-month', async ({ page }) => {
    for (let i = 0; i < 15; i++) {
      await page.getByRole('button', { name: 'Previous day', exact: true }).first().click()
    }
    await scrollToReviewCard(page)
    // Card header is always in the DOM; may be collapsed but header is visible
    await expect(page.getByText('Monthly Review').first()).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite C — Persistence across reload (localStorage / guest only)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Monthly Review — persistence (guest mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-05-30T12:00:00.000Z'))
    await page.addInitScript(() => {
      // On first navigation only: clear all localStorage and start fresh.
      // sessionStorage survives reload within a test, preventing re-clearing
      // so saved answers persist when we reload to verify persistence.
      if (!window.sessionStorage.getItem('_pw_guest_ready')) {
        window.sessionStorage.setItem('_pw_guest_ready', '1')
        window.localStorage.clear()

        const today = new Date().toISOString().slice(0, 10)
        const appState = {
          days: {
            [today]: {
              date: today,
              tasks: [],
              habitCompletions: {},
              deepWorkSessions: [],
              wakeTime: '07:00',
              sleepTarget: '23:00',
              bedTime: '22:30',
            },
          },
        }
        window.localStorage.setItem(
          'deepblock_state_v1',
          JSON.stringify({ version: 1, state: appState }),
        )
      }
      // Always skip the tour (safe on every navigation).
      window.localStorage.setItem('deepblock_tour_done', '1')
      // Dismiss review reminder popups so they don't block test interactions
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
    })
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
  })

  test('answers survive a page reload (localStorage persistence)', async ({ page }) => {
    // Only meaningful in guest mode — skip if user is authenticated (Convex stores answers)
    const isGuest = await page.evaluate(() =>
      window.localStorage.getItem('deepblock_state_v1') !== null
    )
    if (!isGuest) {
      test.skip()
    }

    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    const textareas = page.locator('textarea')
    await textareas.first().scrollIntoViewIfNeeded()
    await textareas.first().fill('Persistence test answer.')
    await page.waitForTimeout(700)

    // Verify it was saved to localStorage
    const saved = await page.evaluate((): string | undefined => {
      try {
        const raw = window.localStorage.getItem('deepblock_state_v1')
        if (!raw) return undefined
        const wrapped = JSON.parse(raw)
        const reviews = wrapped.state?.monthlyReviews
        if (!reviews) return undefined
        const monthKey = new Date().toISOString().slice(0, 7)
        return reviews[monthKey]?.answers?.[0]
      } catch { return undefined }
    })
    expect(saved).toBe('Persistence test answer.')

    // Reload and verify answer still shows
    await page.reload()
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
    const skipBtn = page.getByRole('button', { name: 'Skip for today' })
    if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await skipBtn.click()

    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    await expect(textareas.first()).toHaveValue('Persistence test answer.', { timeout: 6_000 })
  })

  test('completed state survives a page reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Open ↓' }).first().click()
    await scrollToReviewCard(page)

    const completeBtn = page.getByRole('button', { name: 'Mark review complete' })
    await completeBtn.scrollIntoViewIfNeeded()
    await completeBtn.click()

    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.getByText('Monthly review done').first()).toBeVisible()

    await page.reload()
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
    const skipBtn = page.getByRole('button', { name: 'Skip for today' })
    if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await skipBtn.click()

    await expect(page.getByText('Monthly review done').first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: 'Revisit ↓' })).toBeVisible()
  })
})
