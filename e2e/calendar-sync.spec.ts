/**
 * e2e/calendar-sync.spec.ts
 *
 * End-to-end coverage for the Google Calendar sync feature.
 *
 * What is and isn't testable here:
 *  - The real Google consent screen cannot be automated (Google blocks headless
 *    OAuth and requires human consent), so a full "connect → import events"
 *    round-trip is out of scope.
 *  - Everything up to the hand-off to Google IS deterministic, so we assert:
 *      1. The OAuth start redirect is built with the correct client_id /
 *         redirect_uri / scope / access_type (validates the Convex env vars and
 *         catches redirect_uri_mismatch class bugs).
 *      2. The callback page's error handling + the client-side CSRF state guard.
 *      3. The calendar page resolves its connection state (no infinite spinner).
 *
 * The OAuth-start test signs up / signs in a fixed test user on the dev Convex
 * deployment (the connect button only renders when authenticated).
 *
 * NOTE: AppChrome renders its children in BOTH a desktop and a mobile container,
 * so every element appears twice in the DOM. All locators use `.first()` to
 * avoid strict-mode violations (the desktop copy is the visible one at 1280px).
 */

import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = 'pw-calendar@example.com'
const TEST_PASSWORD = 'pw-test-password-123'
const EXPECTED_REDIRECT_URI = 'http://localhost:5173/calendar/callback'
const OAUTH_STATE_KEY = 'deepblock_gcal_oauth_state'

async function skipTour(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
  })
}

/**
 * Sign up (idempotent) then sign in via the planner login wall.
 *
 * Convex Auth's sign-up flow auto-authenticates on success, so a brand-new
 * account lands straight on the planner. If the account already exists, sign-up
 * fails back to the form and we sign in explicitly. We key off the planner's
 * presence (not transient toast text, which gets unmounted on auto-auth).
 */
async function signIn(page: Page) {
  await page.goto('/planner')
  await page.locator('#email').first().waitFor({ timeout: 30_000 })

  const planner = page.locator('[data-tour="date-nav"]').first()

  // Attempt to create the account (auto-authenticates if new).
  await page.getByRole('button', { name: /Sign up/i }).first().click()
  await page.locator('#email').first().fill(TEST_EMAIL)
  await page.locator('#password').first().fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /Create account/i }).first().click()

  // New account → planner appears. Existing account → back to the form.
  try {
    await planner.waitFor({ timeout: 10_000 })
    return
  } catch {
    /* account already existed — fall through to explicit sign-in */
  }
  if (await planner.isVisible().catch(() => false)) return

  // Ensure sign-in mode, then sign in with the existing credentials.
  const toSignin = page
    .getByRole('button', { name: /Already have an account\? Sign in/i })
    .first()
  if (await toSignin.isVisible().catch(() => false)) {
    await toSignin.click()
  }
  await page.locator('#email').first().fill(TEST_EMAIL)
  await page.locator('#password').first().fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /^Sign in$/i }).first().click()

  await planner.waitFor({ timeout: 30_000 })
}

test.describe('Calendar callback page (no auth required)', () => {
  test('shows an error when the OAuth code is missing', async ({ page }) => {
    await page.goto('/calendar/callback')
    await expect(page.getByText(/Missing OAuth code/i).first()).toBeVisible()
  })

  test('surfaces a Google error param', async ({ page }) => {
    await page.goto('/calendar/callback?error=access_denied')
    await expect(page.getByText(/access_denied/i).first()).toBeVisible()
  })

  test('rejects a mismatched OAuth state (CSRF guard)', async ({ page }) => {
    await page.addInitScript(
      ([key]) => {
        window.sessionStorage.setItem(key, 'expected-state')
      },
      [OAUTH_STATE_KEY],
    )
    await page.goto('/calendar/callback?code=fake-code&state=attacker-state')
    await expect(page.getByText(/state mismatch|CSRF/i).first()).toBeVisible()
  })

  test('rejects a callback that omits the state when one was issued (CSRF guard)', async ({
    page,
  }) => {
    // A forged callback must not bypass the check by simply dropping `state`.
    await page.addInitScript(
      ([key]) => {
        window.sessionStorage.setItem(key, 'expected-state')
      },
      [OAUTH_STATE_KEY],
    )
    await page.goto('/calendar/callback?code=fake-code')
    await expect(page.getByText(/state mismatch|CSRF/i).first()).toBeVisible()
  })
})

test.describe('Calendar page', () => {
  test('signed-out users see a sign-in CTA, not an infinite spinner', async ({ page }) => {
    await skipTour(page)
    await page.goto('/calendar')
    await expect(
      page.getByText(/Sign in to connect Google Calendar/i).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Checking connection/i)).toHaveCount(0)
  })

  test('authenticated + not connected shows the Connect card without sync controls', async ({
    page,
  }) => {
    await skipTour(page)
    await signIn(page)
    await page.goto('/calendar')

    await expect(
      page.getByRole('button', { name: /Connect Google Calendar/i }).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /^Not connected$/i }).first()).toBeVisible()

    // Sync + disconnect controls only render once a calendar is connected.
    await expect(page.getByRole('button', { name: /Import from Google/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Push to Google/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Disconnect$/i })).toHaveCount(0)
  })

  test('authenticated user starts OAuth with correct client_id and redirect_uri', async ({
    page,
  }) => {
    await skipTour(page)
    await signIn(page)

    // Intercept the hand-off to Google so we can assert the URL without
    // actually loading Google's servers.
    let oauthUrl = ''
    await page.route('https://accounts.google.com/**', (route) => {
      if (!oauthUrl) oauthUrl = route.request().url()
      return route.abort()
    })

    await page.goto('/calendar')
    const connect = page.getByRole('button', { name: /Connect Google Calendar/i }).first()
    await expect(connect).toBeVisible({ timeout: 20_000 })
    await connect.click()

    await expect.poll(() => oauthUrl, { timeout: 20_000 }).toContain('accounts.google.com')

    const url = new URL(oauthUrl)
    expect(url.searchParams.get('redirect_uri')).toBe(EXPECTED_REDIRECT_URI)
    expect(url.searchParams.get('client_id')).toMatch(/\.apps\.googleusercontent\.com$/)
    expect(url.searchParams.get('client_id')).toMatch(/^651988778288-/)
    expect(url.searchParams.get('scope')).toContain('calendar')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
  })
})
