/**
 * e2e/mobile-responsive.spec.ts
 *
 * Mobile smoke harness: every top-level route is rendered at an iPhone-class
 * viewport and checked for the two failures that actually break a phone —
 * horizontal overflow (the page scrolls sideways) and content hidden behind
 * the fixed bottom tab bar.
 *
 * Conventions match e2e/crawl.spec.ts (addInitScript seeding, guest mode).
 */

import { test, expect, type Page } from '@playwright/test'

const MOBILE = { width: 390, height: 844 } // iPhone 14/15
const ROUTES = ['/', '/planner', '/travel', '/finance', '/calendar'] as const

test.use({ viewport: MOBILE, isMobile: true, hasTouch: true })

async function injectGuestState(page: Page) {
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
    const today = new Date().toISOString().slice(0, 10)
    window.localStorage.setItem(
      'deepblock_state_v1',
      JSON.stringify({
        version: 1,
        state: {
          days: {
            [today]: {
              date: today, tasks: [], habitCompletions: {}, deepWorkSessions: [],
              wakeTime: '07:00', sleepTarget: '23:00', bedTime: '22:30',
            },
          },
        },
      }),
    )
  })
}

/** Click past the auth gate / day-setup modal if either is in the way. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  const guest = page.getByRole('button', { name: 'Continue as guest' })
  if (await guest.isVisible({ timeout: 3_000 }).catch(() => false)) await guest.click()
  const skip = page.getByRole('button', { name: 'Skip for today' })
  if (await skip.isVisible({ timeout: 3_000 }).catch(() => false)) await skip.click()
  await page.waitForTimeout(500)
}

/** Elements whose right edge extends past the viewport, with a locator hint. */
async function overflowingElements(page: Page, vw: number) {
  return page.evaluate((vw) => {
    const out: { tag: string; cls: string; right: number; text: string }[] = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      // Ignore elements inside a deliberate horizontal scroll container.
      let p: Element | null = el.parentElement
      let inScroller = false
      while (p && p !== document.body) {
        const ov = getComputedStyle(p).overflowX
        if (ov === 'auto' || ov === 'scroll') { inScroller = true; break }
        p = p.parentElement
      }
      if (inScroller) continue
      if (r.right > vw + 1) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className?.toString?.() ?? '').slice(0, 120),
          right: Math.round(r.right),
          text: (el as HTMLElement).innerText?.slice(0, 60) ?? '',
        })
      }
    }
    return out.slice(0, 10)
  }, vw)
}

for (const route of ROUTES) {
  test(`${route} fits the mobile viewport`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await injectGuestState(page)
    await page.goto(route)
    await settle(page)

    await expect(page.locator('body')).not.toContainText('Something went wrong')

    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    const offenders = await overflowingElements(page, MOBILE.width)

    expect(
      scrollW,
      `${route} scrolls horizontally (scrollWidth=${scrollW} > ${MOBILE.width}).\n` +
        `Offending elements:\n${JSON.stringify(offenders, null, 2)}`,
    ).toBeLessThanOrEqual(MOBILE.width + 1)

    expect(errors, `${route} threw JS errors`).toHaveLength(0)
  })
}

test('every app route offers a bottom tab bar on mobile', async ({ page }) => {
  await injectGuestState(page)
  // /planner deliberately swaps the global AppMobileNav for its own
  // Plan/Timer/Habits/Stats bar (PlannerPage passes showMobileNav={false}),
  // so match any bottom-fixed nav rather than the global one specifically.
  for (const route of ['/planner', '/travel', '/finance'] as const) {
    await page.goto(route)
    await settle(page)
    const bar = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('nav, div, footer'))
      for (const el of els) {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (cs.position === 'fixed' && r.height > 0 && r.bottom >= window.innerHeight - 2) {
          return { width: Math.round(r.width), height: Math.round(r.height) }
        }
      }
      return null
    })
    expect(bar, `${route} has no fixed bottom tab bar on mobile`).not.toBeNull()
    expect(bar!.width, `${route} tab bar wider than viewport`).toBeLessThanOrEqual(MOBILE.width + 1)
  }
})

test('planner content clears its fixed bottom bar when scrolled to the end', async ({ page }) => {
  await injectGuestState(page)
  await page.goto('/planner')
  await settle(page)

  // Scroll the planner to the very bottom.
  await page.evaluate(() => {
    const sc = document.scrollingElement || document.documentElement
    sc.scrollTop = sc.scrollHeight
    document.querySelectorAll('main, main *').forEach((el) => {
      if (el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight
    })
  })
  await page.waitForTimeout(500)

  const result = await page.evaluate(() => {
    // The planner tab bar: fixed, sits on the bottom edge, holds the Timer tab.
    let bar: DOMRect | null = null
    for (const el of Array.from(document.querySelectorAll('div'))) {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (
        cs.position === 'fixed' && r.height > 0 && r.height < 120 &&
        r.bottom >= window.innerHeight - 2 && el.textContent?.includes('Timer')
      ) { bar = r; break }
    }
    if (!bar) return null

    // Lowest piece of real, non-fixed text content on the page.
    let lowest = 0
    let culprit = ''
    for (const el of Array.from(document.querySelectorAll('main *'))) {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden') continue
      if (el.children.length > 0) continue // leaf nodes only
      // Skip anything inside a fixed overlay (the tab bar's own labels, modals).
      let p: Element | null = el
      let inFixed = false
      while (p && p !== document.body) {
        if (getComputedStyle(p).position === 'fixed') { inFixed = true; break }
        p = p.parentElement
      }
      if (inFixed) continue
      const text = (el as HTMLElement).innerText?.trim()
      if (!text) continue
      const r = el.getBoundingClientRect()
      if (r.height === 0 || r.top > window.innerHeight) continue
      if (r.bottom > lowest) { lowest = r.bottom; culprit = text.slice(0, 40) }
    }
    return { barTop: bar.top, lowest, culprit }
  })

  expect(result, 'planner tab bar not found').not.toBeNull()
  expect(
    result!.lowest,
    `content ("${result!.culprit}") reaches ${Math.round(result!.lowest)}px, ` +
      `under the tab bar starting at ${Math.round(result!.barTop)}px`,
  ).toBeLessThanOrEqual(result!.barTop + 1)
})

test('planner tab bar does not overlap the desktop sidebar at tablet widths', async ({ page }) => {
  // Regression: MobileTabBar is lg:hidden but AppChrome's sidebar appears at md,
  // so between 768px and 1023px both were on screen and the full-width tab bar
  // covered the sidebar's account menu.
  await injectGuestState(page)
  await page.setViewportSize({ width: 800, height: 900 })
  await page.goto('/planner')
  await settle(page)

  const geom = await page.evaluate(() => {
    const aside = document.querySelector('aside')
    let bar: DOMRect | null = null
    for (const el of Array.from(document.querySelectorAll('div'))) {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (cs.position === 'fixed' && r.height > 0 && r.bottom >= window.innerHeight - 2 && el.textContent?.includes('Timer')) {
        bar = r
        break
      }
    }
    return { asideRight: aside ? aside.getBoundingClientRect().right : null, barLeft: bar ? bar.left : null }
  })

  expect(geom.barLeft, 'planner tab bar not found at 800px').not.toBeNull()
  expect(geom.asideRight, 'sidebar not found at 800px').not.toBeNull()
  expect(
    geom.barLeft!,
    `tab bar starts at ${geom.barLeft}px, under a sidebar ending at ${geom.asideRight}px`,
  ).toBeGreaterThanOrEqual(geom.asideRight!)
})

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding tour
// ─────────────────────────────────────────────────────────────────────────────

/** Seed guest state but leave the tour un-completed so it opens. */
async function injectGuestStateWithTour(page: Page) {
  await injectGuestState(page)
  await page.addInitScript(() => window.localStorage.removeItem('deepblock_tour_done'))
}

const tourCard = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('[role="dialog"][aria-labelledby="tour-title"] div.fixed.z-10')
    if (!c) return null
    const r = c.getBoundingClientRect()
    const next = Array.from(c.querySelectorAll('button')).find((b) => /Next|Finish/.test(b.textContent || ''))
    const back = Array.from(c.querySelectorAll('button')).find((b) => /^Back$/.test(b.textContent || ''))
    return {
      title: c.querySelector('#tour-title')?.textContent ?? '',
      body: c.querySelector('#tour-body')?.textContent ?? '',
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      nextBottom: next ? next.getBoundingClientRect().bottom : null,
      backBottom: back ? back.getBoundingClientRect().bottom : null,
      vh: window.innerHeight, vw: window.innerWidth,
    }
  })

async function advanceTour(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('[role="dialog"][aria-labelledby="tour-title"] div.fixed.z-10')
    if (!c) return false
    const n = Array.from(c.querySelectorAll('button')).find((b) => /Next|Finish/.test(b.textContent || ''))
    if (!n) return false
    ;(n as HTMLButtonElement).click()
    return true
  })
}

test('every onboarding step fits the phone with its controls reachable', async ({ page }) => {
  // Regression: the card only became `position: fixed` when a step had a
  // spotlight, which dropped the overlay's padding (card ran edge-to-edge) and
  // left long steps overflowing the bottom with Back/Next off screen.
  await injectGuestStateWithTour(page)
  await page.goto('/planner')
  await settle(page)

  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    const card = await tourCard(page)
    if (!card) break
    seen.push(card.title)

    expect(card.left, `step "${card.title}" touches the left edge`).toBeGreaterThan(0)
    expect(card.right, `step "${card.title}" touches the right edge`).toBeLessThan(card.vw)
    expect(card.top, `step "${card.title}" starts above the viewport`).toBeGreaterThanOrEqual(0)
    expect(card.bottom, `step "${card.title}" overflows the bottom`).toBeLessThanOrEqual(card.vh + 1)
    expect(card.nextBottom!, `step "${card.title}": Next is off screen`).toBeLessThanOrEqual(card.vh)
    expect(card.backBottom!, `step "${card.title}": Back is off screen`).toBeLessThanOrEqual(card.vh)

    if (!(await advanceTour(page))) break
    await page.waitForTimeout(350)
  }
  expect(seen.length, 'tour did not advance through its steps').toBeGreaterThanOrEqual(10)
})

test('onboarding copy matches the mobile UI, not the desktop sidebar', async ({ page }) => {
  await injectGuestStateWithTour(page)
  await page.goto('/planner')
  await settle(page)

  const bodies: string[] = []
  for (let i = 0; i < 12; i++) {
    const card = await tourCard(page)
    if (!card) break
    bodies.push(`${card.title} :: ${card.body}`)
    if (!(await advanceTour(page))) break
    await page.waitForTimeout(300)
  }
  const all = bodies.join('\n')

  // On phones there is no sidebar and no right-click; the tools live in the
  // Timer / Habits / Stats tabs.
  expect(all, 'mobile copy still says "right-click"').not.toMatch(/right-click/i)
  expect(all, 'mobile copy still points at "the sidebar"').not.toMatch(/\bthe sidebar\b/i)
  expect(all, 'mobile copy should name the bottom tabs').toMatch(/bottom tabs|Stats tab/i)
})

test.describe('desktop keeps the full-width copy', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false })

  test('desktop tour still describes the sidebar and right-click', async ({ page }) => {
    await injectGuestStateWithTour(page)
    await page.goto('/planner')
    await settle(page)

    const bodies: string[] = []
    for (let i = 0; i < 12; i++) {
      const card = await tourCard(page)
      if (!card) break
      bodies.push(`${card.title} :: ${card.body}`)
      // The card must stay on screen here too.
      expect(card.bottom, `desktop step "${card.title}" overflows`).toBeLessThanOrEqual(card.vh + 1)
      expect(card.nextBottom!, `desktop step "${card.title}": Next off screen`).toBeLessThanOrEqual(card.vh)
      if (!(await advanceTour(page))) break
      await page.waitForTimeout(300)
    }
    const all = bodies.join('\n')
    expect(bodies.length, 'desktop tour did not advance').toBeGreaterThanOrEqual(10)
    expect(all, 'desktop copy lost the right-click hint').toMatch(/right-click/i)
    expect(all, 'desktop copy lost the sidebar wording').toMatch(/\bthe sidebar\b|Sidebar:/i)
  })
})
