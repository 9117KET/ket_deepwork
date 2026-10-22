/**
 * e2e/mobile-panels.spec.ts
 *
 * Focus, Habits, Review and Challenge on a phone, against a busy seeded day.
 *
 * Each screen gets the same two gates as Today (every control thumb-sized, no
 * text under 11px) plus the one thing its redesign was for: Focus idle has a
 * full-width Start and centres the ring once a block runs; a habit row is one
 * target; Review's heading uses the page-title size.
 */

import { expect, test, type Page } from '@playwright/test'
import { PHONE, seedRichDay, tinyTexts, undersizedTouchTargets } from './helpers/mobile'

test.use(PHONE)

/** Wait for the planner (or the page) to settle, clicking past the guest gate. */
async function open(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle').catch(() => {})
  const guest = page.getByRole('button', { name: 'Continue as guest' })
  if (await guest.isVisible({ timeout: 2_000 }).catch(() => false)) await guest.click()
  await page.waitForTimeout(500)
}

function expectNone<T>(found: T[], what: string) {
  expect(found, `${what}:\n${JSON.stringify(found, null, 2)}`).toEqual([])
}

test.describe('Focus on a phone', () => {
  test('idle is thumb-sized, readable, and Start spans the panel', async ({ page }) => {
    await seedRichDay(page)
    await open(page, '/?tab=focus')

    const idle = page.getByTestId('mobile-focus-idle')
    await expect(idle).toBeVisible()

    expectNone(await undersizedTouchTargets(page), '/?tab=focus controls under 44px')
    expectNone(await tinyTexts(page, 11), '/?tab=focus text under 11px')

    const start = idle.getByRole('button', { name: 'Start', exact: true })
    const startBox = (await start.boundingBox())!
    const panelBox = (await idle.boundingBox())!
    expect(startBox.height, 'Start is under 48px tall').toBeGreaterThanOrEqual(48)
    expect(startBox.width / panelBox.width, 'Start spans less than 90% of the panel').toBeGreaterThanOrEqual(0.9)

    // Idle is one screen: nothing to scroll, and Start sits above the tab bar.
    const fit = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      inner: window.innerHeight,
      barTop: document.querySelector('[data-testid="mobile-tab-bar"]')!.getBoundingClientRect().top,
    }))
    expect(fit.scroll, `idle Focus scrolls: ${fit.scroll}px in a ${fit.inner}px screen`).toBeLessThanOrEqual(fit.inner + 1)
    expect(startBox.y + startBox.height, 'Start runs under the tab bar').toBeLessThanOrEqual(fit.barTop)

    // The custom slot reads "Custom" until tapped, then takes digits.
    await idle.getByRole('button', { name: 'Custom length' }).click()
    await expect(idle.getByLabel('Custom duration in minutes')).toBeVisible()

    await idle.getByRole('button', { name: '25m', exact: true }).click()
    await start.click()
    const running = page.getByTestId('mobile-focus-running')
    await expect(running).toBeVisible()

    const vh = PHONE.viewport.height
    const ring = (await page.getByTestId('mobile-focus-ring').boundingBox())!
    const digits = (await running.getByText(/^\d{2}:\d{2}$/).boundingBox())!
    for (const [name, box] of [['ring', ring], ['digits', digits]] as const) {
      expect(box.y, `${name} starts above the middle 60% of the screen`).toBeGreaterThanOrEqual(vh * 0.2)
      expect(box.y + box.height, `${name} ends below the middle 60% of the screen`).toBeLessThanOrEqual(vh * 0.8)
    }
  })
})

test.describe('Habits on a phone', () => {
  test('rows are whole targets, the toggle persists, and the editor is thumb-sized', async ({ page }) => {
    await seedRichDay(page)
    await open(page, '/?tab=habits')

    const panel = page.getByTestId('mobile-habits')
    await expect(panel).toBeVisible()

    expectNone(await undersizedTouchTargets(page), '/?tab=habits controls under 44px')
    expectNone(await tinyTexts(page, 11), '/?tab=habits text under 11px')

    const count = async () => {
      const text = (await panel.getByText(/\d+ of \d+ today/).textContent()) ?? ''
      return Number(text.match(/(\d+) of/)![1])
    }
    const before = await count()

    // An unticked habit, tapped on its name rather than its check square.
    const row = panel.getByRole('button', { name: /^Check / }).first()
    const label = ((await row.getAttribute('aria-label')) ?? '').replace(/^Check /, '')
    const rowBox = (await row.boundingBox())!
    expect(rowBox.height, 'habit row under 56px').toBeGreaterThanOrEqual(56)
    await row.getByText(label, { exact: true }).click()

    await expect.poll(count).toBe(before + 1)
    await expect(panel.getByRole('button', { name: `Uncheck ${label}`, exact: true })).toBeVisible()

    // The seed is an init script and would overwrite the toggle on reload, so
    // carry what the app saved across the reload, layered after the seed.
    await page.waitForTimeout(400)
    const saved = await page.evaluate(() => window.localStorage.getItem('deepblock_state_v1'))
    expect(saved).toBeTruthy()
    await page.addInitScript((state) => window.localStorage.setItem('deepblock_state_v1', state), saved!)
    await page.reload()
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByTestId('mobile-habits').getByRole('button', { name: `Uncheck ${label}`, exact: true })).toBeVisible()

    // The editor: a sheet over the tab bar, every control at least 44px.
    await page.getByRole('button', { name: 'Edit habit list' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expectNone(await undersizedTouchTargets(page), 'habit editor controls under 44px')

    // The dialog scrolls, which the shared helper treats as a deliberate
    // scroller; measure its controls directly so the check is not vacuous.
    const small = await dialog.evaluate((el) =>
      Array.from(el.querySelectorAll('button, input'))
        .map((c) => ({ html: c.outerHTML.slice(0, 100), box: c.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && (box.width < 44 || box.height < 44))
        .map(({ html, box }) => `${Math.round(box.width)}x${Math.round(box.height)} ${html}`),
    )
    expectNone(small, 'habit editor controls under 44px (measured directly)')

    for (const name of ['Save', 'Cancel']) {
      const button = dialog.getByRole('button', { name, exact: true })
      const box = (await button.boundingBox())!
      expect(box.height, `${name} under 44px`).toBeGreaterThanOrEqual(44)
      // Above the tab bar: the button is what a tap at its centre lands on.
      const onTop = await button.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return hit === el || el.contains(hit)
      })
      expect(onTop, `${name} is covered by something`).toBe(true)
      expect(box.y + box.height, `${name} is below the screen`).toBeLessThanOrEqual(PHONE.viewport.height)
    }
  })
})

test.describe('Review on a phone', () => {
  test('thumb-sized, readable, and titled at the page-title size', async ({ page }) => {
    await seedRichDay(page)
    await open(page, '/review')

    const heading = page.getByRole('heading', { name: 'This week' })
    await expect(heading).toBeVisible()

    expectNone(await undersizedTouchTargets(page), '/review controls under 44px')
    expectNone(await tinyTexts(page, 11), '/review text under 11px')

    expect(await heading.evaluate((el) => getComputedStyle(el).fontSize)).toBe('21px')

    const goal = page.getByLabel('Weekly deep work goal in hours')
    const goalBox = (await goal.boundingBox())!
    expect(goalBox.height, 'goal input under 44px').toBeGreaterThanOrEqual(44)
    expect(await goal.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px')
  })
})

test.describe('Challenge on a phone (guest)', () => {
  test('/challenge controls are thumb-sized', async ({ page }) => {
    await seedRichDay(page)
    await open(page, '/challenge')
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible()
    expectNone(await undersizedTouchTargets(page), '/challenge controls under 44px')
  })

  test('/challenge/join controls are thumb-sized', async ({ page }) => {
    await seedRichDay(page)
    await open(page, '/challenge/join?invite=x')
    await expect(page.getByTestId('mobile-tab-bar')).toBeVisible()
    expectNone(await undersizedTouchTargets(page), '/challenge/join controls under 44px')
  })
})
