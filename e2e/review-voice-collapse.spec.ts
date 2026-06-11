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
          // Mark shutdown complete so the ShutdownRitualModal doesn't auto-open
          shutdownCompletedAt: new Date().toISOString(),
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

/** Like prepareBase but does NOT mark shutdown complete — used for tests that open
 *  the shutdown modal via the "Close day" button. */
async function prepareShutdownTest(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    if (!window.sessionStorage.getItem('_pw_sd_ready')) {
      window.sessionStorage.setItem('_pw_sd_ready', '1')
      try {
        const today = new Date().toISOString().slice(0, 10)
        const raw = window.localStorage.getItem('deepblock_state_v1')
        let appState: Record<string, unknown> = { days: {} }
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.version === 1 && parsed.state) appState = parsed.state
        }
        const days = (appState.days as Record<string, unknown>) ?? {}
        days[today] = {
          date: today, tasks: [], habitCompletions: {}, deepWorkSessions: [],
          wakeTime: '07:00', sleepTarget: '23:00', bedTime: '22:30',
          // shutdownCompletedAt intentionally absent — test will open modal via "Close day"
        }
        appState.days = days
        delete appState.monthlyReviews
        delete (appState as Record<string, unknown>).weeklyReviews
        window.localStorage.setItem('deepblock_state_v1', JSON.stringify({ version: 1, state: appState }))
      } catch (_) { /* ignore */ }
    }
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
  })
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
    await prepareShutdownTest(page)
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
// Suite E — Microphone recording behaviour (mocked SpeechRecognition)
//
// We inject a controllable SpeechRecognition mock via addInitScript so the
// AudioInput component initialises normally. The mock exposes a global
// `window.__mockRecognition` handle for tests to fire events or inspect state.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AudioInput — microphone recording behaviour (mocked)', () => {
  async function prepareWithMockedSpeech(page: Page) {
    await page.addInitScript(() => {
      // Mock class that stores itself globally so tests can interact with it
      class MockSpeechRecognition {
        lang = 'en-US'
        continuous = false
        interimResults = false
        onresult: ((e: unknown) => void) | null = null
        onerror: (() => void) | null = null
        onend: (() => void) | null = null
        onstart: (() => void) | null = null
        _started = false
        _stopped = false

        start() {
          this._started = true
          ;(window as unknown as Record<string, unknown>)['__mockRecognition'] = this
        }
        stop() {
          this._stopped = true
          // Simulate recognition ending
          setTimeout(() => this.onend?.(), 50)
        }
        /** Test helper: fire a speech result event. */
        fireResult(transcript: string) {
          this.onresult?.({
            resultIndex: 0,
            results: {
              length: 1,
              0: { length: 1, 0: { transcript, confidence: 0.9 }, isFinal: true },
              item: (i: number) => ({ length: 1, 0: { transcript, confidence: 0.9 }, isFinal: true }[i as keyof object]),
            },
          })
        }
        /** Test helper: simulate Android Chrome's cumulative interim re-delivery.
         * Fires growing non-final results (all with resultIndex 0, ignoring
         * interimResults=false), then the full sentence as a final result —
         * delivered twice, as real devices re-deliver finals. */
        fireAndroidSequence(finalText: string) {
          const makeEvent = (entries: { transcript: string; isFinal: boolean }[]) => {
            const results: Record<string, unknown> = { length: entries.length }
            entries.forEach((e, i) => {
              results[i] = { length: 1, 0: { transcript: e.transcript, confidence: 0.9 }, isFinal: e.isFinal }
            })
            results['item'] = (i: number) => results[i]
            return { resultIndex: 0, results }
          }
          const words = finalText.split(' ')
          for (let n = 1; n <= words.length; n++) {
            this.onresult?.(makeEvent([{ transcript: words.slice(0, n).join(' '), isFinal: false }]))
          }
          this.onresult?.(makeEvent([{ transcript: finalText, isFinal: true }]))
          this.onresult?.(makeEvent([{ transcript: finalText, isFinal: true }]))
        }
      }

      ;(window as unknown as Record<string, unknown>)['SpeechRecognition'] = MockSpeechRecognition
      ;(window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] = MockSpeechRecognition
    })

    await prepareBase(page)
    await openPlanner(page)
    await dismissDaySetupIfPresent(page)
    await scrollToTrackingDashboard(page)
  }

  test('Test A — recording does not stop prematurely before first speech (no 5 s cutoff)', async ({ page }) => {
    await prepareWithMockedSpeech(page)

    // Expand the weekly review card so mic buttons are visible
    const header = page.getByRole('button').filter({ hasText: 'Weekly Review' })
    await header.first().click()
    await expect(header.first()).toHaveAttribute('aria-expanded', 'true')

    // Click the first mic button
    const micBtn = page.getByRole('button', { name: 'Start voice input' }).first()
    await expect(micBtn).toBeVisible({ timeout: 4_000 })
    await micBtn.click()

    // Verify recognition started
    const started = await page.evaluate(() =>
      !!(window as unknown as Record<string, unknown>)['__mockRecognition'] &&
      (((window as unknown as Record<string, unknown>)['__mockRecognition']) as Record<string, unknown>)['_started']
    )
    expect(started).toBe(true)

    // Wait 3 s — with the old code (5 s timer) this would stop before 5 s elapsed,
    // but only if the timer starts immediately. With our fix, no timer starts until
    // speech is detected — so the button should still show "Stop recording".
    await page.waitForTimeout(3_000)

    const stopBtn = page.getByRole('button', { name: 'Stop recording' }).first()
    await expect(stopBtn).toBeVisible({ timeout: 1_000 })
  })

  test('Test B — transcript from mocked speech appears in the textarea', async ({ page }) => {
    await prepareWithMockedSpeech(page)

    const header = page.getByRole('button').filter({ hasText: 'Weekly Review' })
    await header.first().click()

    const micBtn = page.getByRole('button', { name: 'Start voice input' }).first()
    await expect(micBtn).toBeVisible({ timeout: 4_000 })
    await micBtn.click()

    // Fire a speech result via the mock
    await page.evaluate(() => {
      const mock = (window as unknown as Record<string, unknown>)['__mockRecognition'] as
        { fireResult: (t: string) => void; stop: () => void } | undefined
      mock?.fireResult('This is a test transcript')
      // Immediately stop to deliver the result
      mock?.stop()
    })

    // Wait for transcript to appear in the first textarea of the weekly review
    const weeklySection = page.locator('.mt-3.rounded.border.border-sky-900\\/40')
    const firstTextarea = weeklySection.locator('textarea').first()
    await expect(firstTextarea).toHaveValue(/This is a test transcript/, { timeout: 4_000 })
  })

  test('Test D — Android-style duplicated interims produce the sentence exactly once', async ({ page }) => {
    await prepareWithMockedSpeech(page)

    const header = page.getByRole('button').filter({ hasText: 'Weekly Review' })
    await header.first().click()

    const micBtn = page.getByRole('button', { name: 'Start voice input' }).first()
    await expect(micBtn).toBeVisible({ timeout: 4_000 })
    await micBtn.click()

    // Replay the Android quirk: cumulative interims + duplicated final
    await page.evaluate(() => {
      const mock = (window as unknown as Record<string, unknown>)['__mockRecognition'] as
        { fireAndroidSequence: (t: string) => void; stop: () => void } | undefined
      mock?.fireAndroidSequence('Today actually went pretty well')
      mock?.stop()
    })

    // Exact match — any duplicated fragment ("Today Today actually ...") fails
    const weeklySection = page.locator('.mt-3.rounded.border.border-sky-900\\/40')
    const firstTextarea = weeklySection.locator('textarea').first()
    await expect(firstTextarea).toHaveValue('Today actually went pretty well', { timeout: 4_000 })
  })

  test('Test C — navigating away while recording does not throw errors', async ({ page }) => {
    await prepareWithMockedSpeech(page)

    const header = page.getByRole('button').filter({ hasText: 'Weekly Review' })
    await header.first().click()

    const micBtn = page.getByRole('button', { name: 'Start voice input' }).first()
    await expect(micBtn).toBeVisible({ timeout: 4_000 })
    await micBtn.click()

    // Verify recording started
    const started = await page.evaluate(() =>
      !!(window as unknown as Record<string, unknown>)['__mockRecognition']
    )
    expect(started).toBe(true)

    // Navigate away (triggers component unmount → cleanup useEffect should call stop)
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/planner')

    // Give cleanup a moment to run
    await page.waitForTimeout(500)

    // No uncaught JS errors should have occurred during unmount
    expect(errors).toHaveLength(0)
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
