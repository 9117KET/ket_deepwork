/**
 * e2e/challenge-group.spec.ts
 *
 * Group challenges (up to eight people) and reopening, as far as a browser
 * can see them without signed-in accounts.
 *
 * 1. As a guest, the routes a group member and an invitee reach still show
 *    the sign-in form and do not crash (`/challenge/join` included).
 * 2. The dashboard itself, drawn from a fixture by
 *    `e2e/harness/challenge-group.html` (no backend): a row and a Nudge per
 *    member, the invite while seats remain, the score for everyone, the
 *    season grid on a 320px phone, the leave copy, Reopen for the creator
 *    only. Writes are not exercised: a click on a verb would call the live
 *    backend, so only what opens and what it says is checked.
 */

import { test, expect, type Page } from '@playwright/test'
import { PHONE } from './helpers/mobile'

async function guest(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('deepblock_guest_session', '1')
    window.localStorage.setItem('deepblock_tour_done', '1')
  })
}

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function harness(page: Page, kase: string) {
  await page.goto(`/e2e/harness/challenge-group.html?case=${kase}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/** Controls under 44px tall on a coarse pointer, with their names. */
async function smallControls(page: Page) {
  return await page.evaluate(() =>
    [...document.querySelectorAll('button, select, input, a[href]')]
      .filter((el) => (el as HTMLElement).offsetParent !== null && !el.closest('table'))
      .map((el) => ({ name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((c) => c.h < 44),
  )
}

test.describe('guest', () => {
  for (const route of ['/challenge', '/challenge/join?invite=group-invite-token']) {
    test(`${route}: sign-in form, no crash`, async ({ page }) => {
      const errors = watchErrors(page)
      await guest(page)
      await page.goto(route)
      await expect(page.getByText('Something went wrong')).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }
})

test.describe('group dashboard (fixture)', () => {
  test('one row and one Nudge per member, in join order, with the warning on the warned row', async ({ page }) => {
    const errors = watchErrors(page)
    await harness(page, 'group')
    const today = page.getByRole('region', { name: 'Today', exact: true })
    for (const name of ['Ana', 'Ben', 'Cy', 'Dee']) await expect(today.getByRole('article', { name: `${name} today` })).toBeVisible()
    const order = await today.getByRole('article').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    expect(order).toEqual(['You today', 'Ana today', 'Ben today', 'Cy today', 'Dee today'])
    // Ana has locked in (nothing to nudge about before the evening); the others owe a plan, each with their own Nudge.
    const evening = await page.evaluate(() => new Date().getHours() * 60 + new Date().getMinutes() >= 21 * 60 + 30)
    if (!evening) {
      for (const name of ['Ben', 'Cy', 'Dee']) await expect(today.getByRole('button', { name: `Nudge ${name}` })).toBeVisible()
      await expect(today.getByRole('button', { name: 'Nudge Ana' })).toHaveCount(0)
    }
    // The warning sits on Cy's row, not in a banner, and says Cy drops out (a group of five).
    await expect(today.getByRole('article', { name: 'Cy today' })).toContainText('Cy drops out tomorrow unless they lock in or check in.')
    // Share is one action for the group, not one per row.
    await expect(today.getByRole('button', { name: 'Share my plan' })).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test('the invite shows while seats remain, with how many', async ({ page }) => {
    await harness(page, 'group')
    const invite = page.getByRole('button', { name: 'Invite someone' })
    await expect(invite).toBeVisible()
    await expect(page.getByText('3 seats left')).toBeVisible()
    await invite.click()
    await expect(page.getByText('A link works for seven days and seats one person. A challenge holds up to 8.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create invite link' })).toBeVisible()
  })

  test('at 8 the invite is gone', async ({ page }) => {
    await harness(page, 'full')
    await expect(page.getByRole('region', { name: 'Today', exact: true }).getByRole('article')).toHaveCount(8)
    await expect(page.getByRole('button', { name: 'Invite someone' })).toHaveCount(0)
  })

  test('the score lists everyone, you first, then join order', async ({ page }) => {
    await harness(page, 'group')
    const score = page.getByRole('region', { name: 'Everyone so far' })
    const names = await score.getByRole('rowheader').allTextContents()
    expect(names).toEqual(['You', 'Ana', 'Ben', 'Cy', 'Dee'])
    await expect(score).toContainText('Days the challenge was closed count for nobody.')
  })

  test('the header says it was reopened, once', async ({ page }) => {
    await harness(page, 'group')
    // "Reopened 5 Nov" or "Reopened Nov 5", by locale.
    await expect(page.getByText(/^Reopened \S+ \S+$/)).toHaveCount(1)
  })

  test('goals and don’ts: yours, then each member’s, read-only', async ({ page }) => {
    await harness(page, 'group')
    const section = page.getByRole('region', { name: 'Goals and don’ts' })
    const titles = await section.getByRole('heading', { level: 3 }).allTextContents()
    expect(titles).toEqual(['Yours', 'Ana’s', 'Ben’s', 'Cy’s', 'Dee’s'])
    await expect(section.getByRole('button', { name: 'Edit' })).toHaveCount(1)
  })

  test('the leave sheet says who becomes the creator', async ({ page }) => {
    await harness(page, 'group')
    await page.getByRole('button', { name: 'Leave challenge' }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toContainText('Ana becomes the creator and the challenge goes on.')
    await expect(sheet).toContainText('You can come back with a new invite link, and everything you recorded comes back with you.')
    await expect(sheet).not.toContainText('both')
  })
})

test.describe('season grid on a 320px phone (fixture)', () => {
  test('one member at a time, picked by name; every member spoken; closed is never missed', async ({ browser }) => {
    const context = await browser.newContext({ ...PHONE, viewport: { width: 320, height: 720 } })
    const page = await context.newPage()
    await harness(page, 'group')
    const season = page.getByRole('region', { name: 'Season', exact: true })
    const picker = season.getByLabel('Marks for')
    await expect(picker).toBeVisible()
    expect(await picker.locator('option').allTextContents()).toEqual(['You', 'Ana', 'Ben', 'Cy', 'Dee'])
    // No horizontal scroll at 320px.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    // Each cell speaks every member, you first.
    const cell = season.locator('td .sr-only', { hasText: 'today' }).first()
    await expect(cell).toContainText(/you .+, Ana .+, Ben .+, Cy .+, Dee /)
    // Whole season, then the closed stretch reads "closed" for everybody and never "missed".
    await season.getByRole('button', { name: 'Whole season' }).click()
    const closed = season.locator('td .sr-only', { hasText: 'you closed' })
    await expect(closed).toHaveCount(3)
    for (const text of await closed.allTextContents()) {
      expect(text).toMatch(/you closed, Ana closed, Ben closed, Cy closed, Dee closed/)
      expect(text).not.toContain('missed')
    }
    await expect(season.getByRole('list', { name: 'Key' })).toContainText('closed')
    // One mark per day for a group; picking another member redraws the marks.
    const marks = season.locator('tbody td:has(.sr-only)').first().locator('[data-marks] > span')
    await expect(marks).toHaveCount(1)
    await picker.selectOption({ label: 'Ben' })
    await expect(picker).toHaveValue('key-ben')
    expect(await smallControls(page), 'controls under 44px').toEqual([])
    await context.close()
  })

  test('two people keep two marks a day and the left/right key', async ({ page }) => {
    await harness(page, 'two')
    const season = page.getByRole('region', { name: 'Season', exact: true })
    await expect(season.getByLabel('Marks for')).toHaveCount(0)
    await expect(season).toContainText('Left mark you, right mark Ana.')
    const marks = season.locator('tbody td:has(.sr-only)').first().locator('[data-marks] > span')
    await expect(marks).toHaveCount(2)
    await expect(page.getByRole('heading', { name: 'Head to head' })).toBeVisible()
  })
})

test.describe('two people read as before (fixture)', () => {
  test('Share and Nudge sit in the partner row; the invite stays quiet below', async ({ page }) => {
    await harness(page, 'two')
    const today = page.getByRole('region', { name: 'Today', exact: true })
    const partner = today.getByRole('article', { name: 'Ana today' })
    await expect(partner.getByRole('button', { name: 'Share my plan' })).toBeVisible()
    await expect(today.getByRole('button', { name: /^Nudge Ana$/ })).toHaveCount(0)
    await expect(page.getByText('6 seats left')).toBeVisible()
  })
})

test.describe('reopen (fixture)', () => {
  test('creator, end date passed: the sheet asks for a new end date and waits for one', async ({ page }) => {
    const errors = watchErrors(page)
    await harness(page, 'ended-past')
    await expect(page.getByRole('button', { name: 'Delete challenge' })).toBeVisible()
    await page.getByRole('button', { name: 'Reopen challenge' }).click()
    const sheet = page.getByRole('dialog', { name: /Reopen Group season/ })
    await expect(sheet).toContainText('has passed. Pick a new one to run to.')
    const date = sheet.getByLabel('New end date')
    const min = await date.getAttribute('min')
    const max = await date.getAttribute('max')
    expect(min).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(max! > min!).toBe(true)
    const verb = sheet.getByRole('button', { name: 'Reopen challenge' })
    await expect(verb).toBeDisabled()
    await date.fill(min!)
    await expect(verb).toBeEnabled()
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('creator, end date ahead: one verb, no date', async ({ page }) => {
    await harness(page, 'ended-ahead')
    await page.getByRole('button', { name: 'Reopen challenge' }).click()
    const sheet = page.getByRole('dialog', { name: /Reopen Group season/ })
    await expect(sheet.getByLabel('New end date')).toHaveCount(0)
    await expect(sheet).toContainText('again.')
    await expect(sheet.getByRole('button', { name: 'Reopen challenge' })).toBeEnabled()
  })

  test('not the creator: no Reopen, and the ended sentence says the creator can', async ({ page }) => {
    await harness(page, 'ended-member')
    await expect(page.getByRole('button', { name: 'Reopen challenge' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delete challenge' })).toHaveCount(0)
    await expect(page.getByText('The creator can reopen it.')).toBeVisible()
    await expect(page.getByText('everyone left')).toBeVisible()
  })
})
