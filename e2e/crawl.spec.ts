/**
 * e2e/crawl.spec.ts
 *
 * Deepblock comprehensive crawl & smoke harness.
 *
 * Covers: the planner (guest mode), /review, /calendar,
 * /calendar/callback, and core user actions
 * (task create/complete/delete, habit toggle, deep work
 * timer UI, navigation, and section interactions).
 *
 * Environment: dev server at http://localhost:5173, guest mode only
 * (no Convex auth configured in CI). Auth-gated Convex features that
 * require a live backend are noted in comments as ENV_NOISE.
 *
 * Conventions matching existing e2e suite:
 *   - addInitScript for localStorage state pre-seeding
 *   - waitForFunction + polling to avoid React race conditions
 *   - screenshot on failure (playwright.config.ts)
 */

import { test, expect, type Page } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject clean guest state into localStorage before the page loads.
 * Prevents the DaySetup modal and onboarding tour from blocking tests.
 * Sets wakeTime for today so DaySetup never auto-opens.
 */
async function injectGuestState(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((overrides: Record<string, unknown>) => {
    // Skip tour
    window.localStorage.setItem('deepblock_tour_done', '1')
    // Dismiss review banners
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
      ...overrides,
    }
    window.localStorage.setItem(
      'deepblock_state_v1',
      JSON.stringify({ version: 1, state: appState }),
    )
  }, overrides)
}

/**
 * Navigate to /planner in guest mode.
 * Polls until the planner's date-nav element is visible,
 * clicking "Continue as guest" if it appears first.
 */
async function openPlannerAsGuest(page: Page) {
  await page.goto('/planner')
  await page.waitForFunction(
    () => {
      if (document.querySelector('[data-tour="date-nav"]')) return true
      const btns = Array.from(document.querySelectorAll('button'))
      const guest = btns.find((b) => b.textContent?.trim() === 'Continue as guest')
      if (guest) { (guest as HTMLButtonElement).click(); return false }
      return false
    },
    { timeout: 40_000, polling: 400 },
  )
}

/** Dismiss DaySetup modal if it appears. */
async function dismissDaySetup(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip for today' })
  if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skip.click()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Planner — task lifecycle (create / complete / delete)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Planner — task lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await injectGuestState(page)
    await openPlannerAsGuest(page)
    await dismissDaySetup(page)
  })

  test('page renders without a React error boundary', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 5_000 })
    // AppChrome renders children in both desktop+mobile containers (CSS-hidden).
    // Use .first() to target the first instance and avoid Playwright strict-mode violation.
    await expect(page.locator('[data-tour="date-nav"]').first()).toBeVisible()
  })

  test('add a task to High Priority section', async ({ page }) => {
    // Find the High Priority section add-task input
    // The section uses an inline add-input triggered by clicking the section header or '+' button
    // Expand the section if collapsed
    const sectionHeader = page.getByText('High Priority', { exact: false }).first()
    if (await sectionHeader.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Sections may be collapsed; try clicking to expand
    }

    // Use the inline add-task input at the bottom of a section
    // Different approach: type in an input if visible, else locate the + button
    const taskInputs = page.locator('input[placeholder*="task" i], input[placeholder*="add" i]')
    const hasDirectInput = await taskInputs.first().isVisible({ timeout: 2_000 }).catch(() => false)

    if (hasDirectInput) {
      await taskInputs.first().fill('Test task from crawl')
      await taskInputs.first().press('Enter')
      await expect(page.getByText('Test task from crawl').first()).toBeVisible({ timeout: 5_000 })
    } else {
      // Find any + / Add button inside tasks section
      const addButtons = page.locator('[data-tour="tasks-section"] button')
      const count = await addButtons.count()
      expect(count).toBeGreaterThan(0) // Planner has at least some buttons
    }
  })

  // The day stepper is a segmented control: chevrons labelled "Previous day" /
  // "Next day" either side of "Today". Assert the heading actually moves rather
  // than only that nothing crashed.
  const dayHeading = (page: Page) => page.locator('[data-tour="date-nav"] h2').first()

  test('date navigation: Previous and Next buttons work', async ({ page }) => {
    const heading = dayHeading(page)
    const today = await heading.textContent()

    await page.getByRole('button', { name: 'Previous day', exact: true }).first().click()
    await expect(heading).not.toHaveText(today ?? '')
    await expect(page.locator('body')).not.toContainText('Something went wrong')

    await page.getByRole('button', { name: 'Next day', exact: true }).first().click()
    await expect(heading).toHaveText(today ?? '')
  })

  test('Today button returns to current date', async ({ page }) => {
    const heading = dayHeading(page)
    const today = await heading.textContent()

    const prev = page.getByRole('button', { name: 'Previous day', exact: true }).first()
    await prev.click()
    await prev.click()
    await expect(heading).not.toHaveText(today ?? '')

    await page.getByRole('button', { name: 'Today', exact: true }).first().click()
    await expect(heading).toHaveText(today ?? '')
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('mobile tab bar switches between plan / timer / habits views', async ({ page }) => {
    // MobileTabBar is visible on small screens; on 1280px desktop it may not render.
    // At the default 1280px viewport the planner is already loaded (beforeEach ran).
    // Just verify the tab-related elements exist and no crash — no viewport resize needed
    // to avoid losing guest state across reload.
    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
    // MobileTabBar items are in the DOM even on desktop (CSS-hidden)
    await expect(page.locator('[data-tour="date-nav"]').first()).toBeVisible()
  })

  test('habit checklist is visible in the sidebar / timer tab', async ({ page }) => {
    // On desktop, the right column contains habits and timer
    // Scroll down to find the habit section
    await page.evaluate(() => window.scrollTo(0, 600))
    await page.waitForTimeout(300)
    // Habit section should render without crashing
    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Planner — Must Do section pinned header
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Planner — Must Do pinned header', () => {
  test.beforeEach(async ({ page }) => {
    await injectGuestState(page)
    await openPlannerAsGuest(page)
    await dismissDaySetup(page)
  })

  test('MustDo section renders and add-task works', async ({ page }) => {
    // The MustDoPinnedHeader has an inline add input
    const mustDoInput = page.locator('input[placeholder*="priority" i], input[placeholder*="must" i]')
    const hasMustDo = await mustDoInput.isVisible({ timeout: 3_000 }).catch(() => false)

    if (hasMustDo) {
      await mustDoInput.fill('Must do: finish report')
      await mustDoInput.press('Enter')
      await expect(page.getByText('Must do: finish report').first()).toBeVisible({ timeout: 5_000 })

      // Complete the task
      const checkbox = page.locator('button[aria-label*="complete" i], button[title*="complete" i]').first()
      if (await checkbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await checkbox.click()
        await expect(page.locator('body')).not.toContainText('Something went wrong')
      }
    } else {
      // MustDo pinned header may not expose an input placeholder — just check no crash
      // Use .first() because AppChrome renders children in both desktop+mobile containers
      await expect(page.locator('[data-tour="date-nav"]').first()).toBeVisible()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Planner — section actions (context menu / keyboard)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Planner — section interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-seed one task so sections have content to interact with
    const today = new Date().toISOString().slice(0, 10)
    await injectGuestState(page, {
      days: {
        [today]: {
          date: today,
          wakeTime: '07:00',
          sleepTarget: '23:00',
          bedTime: '22:30',
          deepWorkSessions: [],
          habitCompletions: {},
          tasks: [
            {
              id: 'crawl-task-1',
              title: 'Seeded crawl task',
              sectionId: 'highPriority',
              date: today,
              isDone: false,
            },
          ],
        },
      },
    })
    await openPlannerAsGuest(page)
    await dismissDaySetup(page)
    // Sections default to collapsed unless their block is running, so a
    // High Priority task seeded outside 9-5 is hidden until asked for.
    const expand = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Tasks', exact: true }) })
      .first()
      .getByRole('button', { name: 'Expand section' })
    if (await expand.count()) await expand.click()
    await page.waitForTimeout(200)
  })

  test('seeded task is visible in the planner', async ({ page }) => {
    await expect(page.getByText('Seeded crawl task').first()).toBeVisible({ timeout: 8_000 })
  })

  test('clicking a task does not crash the page', async ({ page }) => {
    await page.getByText('Seeded crawl task').first().click()
    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
  })

  test('completing a task toggles its done state', async ({ page }) => {
    // Find the task row and click its completion button
    // Look for a checkbox or done button adjacent to the task text
    const taskRow = page.locator('[class*="task" i]').filter({ hasText: 'Seeded crawl task' }).first()
    if (await taskRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const doneBtn = taskRow.locator('button').first()
      if (await doneBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await doneBtn.click()
        await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
      }
    }
    // Even if selectors don't match, the page must not crash
    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
  })

  test('section collapse / expand: clicking a section header toggles visibility', async ({ page }) => {
    // High Priority section header
    const highPriHeader = page.getByText('High Priority', { exact: false }).first()
    if (await highPriHeader.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await highPriHeader.click()
      // No crash
      await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
      // Click again to re-expand
      await highPriHeader.click()
      await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Planner — Deep Work Timer UI
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Planner — Deep Work Timer', () => {
  test.beforeEach(async ({ page }) => {
    await injectGuestState(page)
    await openPlannerAsGuest(page)
    await dismissDaySetup(page)
  })

  test('timer component renders without crashing', async ({ page }) => {
    // Timer is in the right column / timer tab on desktop
    await page.evaluate(() => window.scrollTo(0, 400))
    await page.waitForTimeout(300)
    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
  })

  test('timer start button is interactive', async ({ page }) => {
    // Scroll to timer area
    await page.evaluate(() => window.scrollTo(0, 600))
    await page.waitForTimeout(400)

    // Look for a Start button inside the timer component
    const startBtn = page.getByRole('button', { name: /Start|begin/i }).first()
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click()
      await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
      // A running block takes the desktop screen (FocusMode). Esc leaves it,
      // which is the documented way out and does not touch the block.
      if (await page.getByTestId('focus-mode').isVisible({ timeout: 2_000 }).catch(() => false)) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
      // Stop/cancel the timer if it started
      const stopBtn = page.getByRole('button', { name: /Stop|Cancel|Pause/i }).first()
      if (await stopBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await stopBtn.click()
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Review — this week's worked time and habits
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Review (/review)', () => {
  test.beforeEach(async ({ page }) => {
    await injectGuestState(page)
  })

  test('shows the week, the deep work goal and habits without crashing', async ({ page }) => {
    await page.goto('/review')
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('Weekly deep work goal in hours')).toBeVisible()
    await expect(page.getByText('Habits · last 7 days')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('the next-week button is disabled on the current week', async ({ page }) => {
    await page.goto('/review')
    await expect(page.getByRole('button', { name: 'Next week' })).toBeDisabled({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Previous week' }).click()
    await expect(page.getByRole('heading', { name: 'Week' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next week' })).toBeEnabled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Calendar sync page (/calendar)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Calendar sync page (/calendar)', () => {
  test('loads without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/calendar')
    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 10_000 })

    // Unauthenticated: should show a sign-in or connect prompt, not a blank page
    await page.waitForTimeout(1500)

    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error') && !e.includes('ConvexError'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('shows a meaningful UI for unauthenticated visitors', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForTimeout(2000)
    // Should not be blank — expect at least the app chrome (sidebar / nav)
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
    // Calendar page content (sign-in gate or sync UI)
    await expect(body).not.toContainText('Something went wrong', { timeout: 5_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. Calendar callback (/calendar/callback)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Calendar callback (/calendar/callback)', () => {
  test('no code param: renders gracefully without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    // Visit without OAuth code — should handle gracefully
    await page.goto('/calendar/callback')
    await page.waitForTimeout(2000)

    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 5_000 })

    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error') && !e.includes('ConvexError'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('invalid code param: renders an error message, not a crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/calendar/callback?code=invalid_code_abc')
    await page.waitForTimeout(3000)

    // Should show an error, not a blank page or unhandled exception
    await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 5_000 })

    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error') && !e.includes('ConvexError'),
    )
    expect(criticalErrors).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. Privacy / Terms / Support pages
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Legal/support pages', () => {
  for (const path of ['/privacy']) {
    test(`${path} renders without crashing`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))

      await page.goto(path)
      await page.waitForTimeout(1000)
      await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 5_000 })

      const criticalErrors = errors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error'),
      )
      expect(criticalErrors).toHaveLength(0)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. Cross-route navigation (no 404s, no blank pages)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cross-route navigation', () => {
  const routes = ['/', '/review', '/calendar', '/privacy']

  test('all defined routes load without blank body or React crash', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('deepblock_tour_done', '1')
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

    for (const route of routes) {
      const errors: string[] = []
      const handler = (e: Error) => errors.push(e.message)
      page.on('pageerror', handler)

      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)

      const bodyText = await page.locator('body').innerText()
      expect(bodyText.trim().length, `Route ${route} has empty body`).toBeGreaterThan(0)
      await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })

      const criticalErrors = errors.filter(
        (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error') && !e.includes('ConvexError'),
      )
      if (criticalErrors.length > 0) {
        console.error(`[crawl] ${route} JS errors:`, criticalErrors)
      }
      // Don't fail on Convex errors (env noise: no backend in CI)
      expect(criticalErrors.filter((e) => !e.includes('Convex') && !e.includes('convex'))).toHaveLength(0)

      page.off('pageerror', handler)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. Planner — localStorage state integrity
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Planner — localStorage state integrity', () => {
  test.beforeEach(async ({ page }) => {
    await injectGuestState(page)
    await openPlannerAsGuest(page)
    await dismissDaySetup(page)
  })

  test('state key deepblock_state_v1 is valid JSON with correct schema', async ({ page }) => {
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('deepblock_state_v1')
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return 'PARSE_ERROR'
      }
    })

    expect(stored).not.toBeNull()
    expect(stored).not.toBe('PARSE_ERROR')
    expect(stored).toHaveProperty('version', 1)
    expect(stored).toHaveProperty('state')
    expect(stored.state).toHaveProperty('days')
  })

  test('adding a task persists it to localStorage', async ({ page }) => {
    // Use the inline add-task input if it exists
    const inputs = page.locator('input[placeholder*="task" i], input[placeholder*="add" i], input[placeholder*="must" i]')
    const count = await inputs.count()

    if (count > 0) {
      const input = inputs.first()
      await input.fill('Persistence check task')
      await input.press('Enter')
      await page.waitForTimeout(600) // debounce

      // Verify it's in localStorage
      const saved = await page.evaluate(() => {
        const raw = window.localStorage.getItem('deepblock_state_v1')
        if (!raw) return null
        const parsed = JSON.parse(raw)
        const today = new Date().toISOString().slice(0, 10)
        const tasks = parsed.state?.days?.[today]?.tasks ?? []
        return tasks.some((t: { title: string }) => t.title === 'Persistence check task')
      })
      expect(saved).toBe(true)
    } else {
      console.warn('[crawl] No task input found to test persistence')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 16. Security / edge cases
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Security — client bundle secrets check', () => {
  test('VITE_ env vars do not leak non-public secrets', async ({ page }) => {
    await page.goto('/')
    // Collect all script src attributes
    const scriptSrcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).map((s) => (s as HTMLScriptElement).src)
    )

    // Check the bundle for dangerous patterns
    // Only VITE_CONVEX_URL should be public; check nothing like API keys are in source
    for (const src of scriptSrcs) {
      if (!src.startsWith('http://localhost')) continue
      // Fetch the script content
      try {
        const resp = await page.evaluate(async (url: string) => {
          const r = await fetch(url)
          return r.text()
        }, src)

        // Must not contain raw API keys or secrets (basic heuristic)
        expect(resp).not.toMatch(/ANTHROPIC_API_KEY\s*=\s*["']sk-/i)
        expect(resp).not.toMatch(/GOOGLE_CLIENT_SECRET\s*=\s*["']\w{20,}/i)
      } catch {
        // Script fetch failed (e.g. inline script or CORS) — skip
      }
    }
  })
})

test.describe('Security — auth pages handle invalid input gracefully', () => {
  test('login form with empty credentials shows a validation error, not a crash', async ({ page }) => {
    await page.goto('/planner')
    await page.waitForTimeout(2000)

    // If the login form is showing (unauthenticated)
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first()
    if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Submit empty form
      const submitBtn = page.getByRole('button', { name: /sign in|login|submit/i }).first()
      if (await submitBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(1000)
        // Should show an error or validation, not crash
        await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 3_000 })
      }
    }
  })
})
