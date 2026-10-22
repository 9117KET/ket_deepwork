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
import { PHONE, seedRichDay, undersizedTouchTargets } from './helpers/mobile'

const MOBILE = PHONE.viewport // iPhone 14/15
const ROUTES = ['/', '/review', '/calendar'] as const

test.use(PHONE)

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
  for (const route of ['/', '/review'] as const) {
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
    // The planner tab bar. Found by test id rather than by the text of one of
    // its tabs — the labels are Today / Focus / Habits / Review now, and a
    // rename should not read as "the bar is missing".
    const barEl = document.querySelector('[data-testid="mobile-tab-bar"]')
    if (!barEl) return null
    const bar: DOMRect = barEl.getBoundingClientRect()

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
    const barEl = document.querySelector('[data-testid="mobile-tab-bar"]')
    const bar = barEl ? barEl.getBoundingClientRect() : null
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
// Device-compatibility foundations
//
// The checks above prove the app fits one iPhone-class viewport. These prove it
// survives the rest of the spread: the narrowest screens still shipping, a
// phone turned sideways, notched devices, and fingers instead of a cursor.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Widths that actually break layouts, smallest first:
 *  - 280px  Galaxy Fold cover screen / very old Android
 *  - 320px  iPhone SE (1st gen), the classic floor
 *  - 360px  the most common Android width in the world
 *  - 844x390 a phone held sideways: wide, but only ~390px tall
 */
const DEVICE_MATRIX = [
  { name: 'Fold cover', width: 280, height: 653 },
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'Android', width: 360, height: 740 },
  { name: 'landscape phone', width: 844, height: 390 },
] as const

for (const device of DEVICE_MATRIX) {
  for (const route of ['/', '/review'] as const) {
    test(`${route} fits a ${device.name} (${device.width}x${device.height})`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height })
      await injectGuestState(page)
      await page.goto(route)
      await settle(page)

      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
      const offenders = await overflowingElements(page, device.width)
      expect(
        scrollW,
        `${route} scrolls sideways on a ${device.name} (${scrollW} > ${device.width}).\n` +
          `Offenders:\n${JSON.stringify(offenders, null, 2)}`,
      ).toBeLessThanOrEqual(device.width + 1)
    })
  }
}

// undersizedTouchTargets lives in ./helpers/mobile (shared with the other
// mobile specs); see its doc comment for the two deliberate exceptions.

for (const route of ['/', '/review'] as const) {
  test(`${route} controls are thumb-sized on touch devices`, async ({ page }) => {
    await injectGuestState(page)
    await page.goto(route)
    await settle(page)

    const tiny = await undersizedTouchTargets(page)
    expect(
      tiny,
      `${route} has ${tiny.length} control(s) under 44x44 on a touch device:\n` +
        JSON.stringify(tiny.slice(0, 12), null, 2),
    ).toEqual([])
  })
}

test('the page opts into the display cutout and pads for it', async ({ page }) => {
  // Without `viewport-fit=cover` the browser letterboxes the page and every
  // env(safe-area-inset-*) resolves to 0, silently disabling all of the
  // padding below. The meta tag and the rules are a pair; assert both.
  await injectGuestState(page)
  await page.goto('/planner')
  await settle(page)

  const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content')
  expect(viewportMeta, 'viewport meta must opt into the display cutout').toContain(
    'viewport-fit=cover',
  )

  const usesSafeArea = await page.evaluate(() =>
    Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules).some((rule) =>
          rule.cssText.includes('safe-area-inset'),
        )
      } catch {
        return false // cross-origin sheet (fonts)
      }
    }),
  )
  expect(usesSafeArea, 'no stylesheet references safe-area-inset').toBe(true)
})

test('a landscape phone still shows content, not just chrome', async ({ page }) => {
  // 390px of height minus a header and a fixed tab bar leaves very little; the
  // tab bar trims its padding and drops its labels via the `short:` breakpoint.
  await page.setViewportSize({ width: 844, height: 390 })
  await injectGuestState(page)
  await page.goto('/planner')
  await settle(page)

  const chrome = await page.evaluate(() => {
    let fixedHeight = 0
    for (const el of Array.from(document.querySelectorAll('nav, div, header, footer'))) {
      const cs = getComputedStyle(el)
      if (cs.position !== 'fixed') continue
      const r = el.getBoundingClientRect()
      if (r.height === 0 || r.height > 200) continue
      // Only bars pinned to the top or bottom edge.
      if (r.top <= 1 || r.bottom >= window.innerHeight - 1) fixedHeight += r.height
    }
    return { fixedHeight, vh: window.innerHeight }
  })

  expect(
    chrome.fixedHeight,
    `fixed chrome eats ${Math.round(chrome.fixedHeight)}px of a ${chrome.vh}px-tall screen`,
  ).toBeLessThan(chrome.vh * 0.3)
})

// ─────────────────────────────────────────────────────────────────────────────
// Mobile foundations (run 2026-10-22, spec 01)
//
// The shared base every phone screen stands on: the tab bar reaches every
// route, fields never trigger iOS zoom, motion respects the OS setting, the
// bar wears the artboard colours, and toasts sit above it rather than under.
// ─────────────────────────────────────────────────────────────────────────────

const OFF_PLANNER_ROUTES = ['/calendar', '/calendar/callback', '/challenge/join?invite=x', '/challenge'] as const

for (const route of OFF_PLANNER_ROUTES) {
  test(`${route} shows the fixed bottom tab bar on a phone`, async ({ page }) => {
    await injectGuestState(page)
    await page.goto(route)
    await settle(page)

    const bar = page.getByTestId('mobile-tab-bar')
    await expect(bar, `${route} has no tab bar`).toBeVisible()
    const geom = await bar.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { position: getComputedStyle(el).position, bottom: r.bottom, vh: window.innerHeight }
    })
    expect(geom.position, `${route} tab bar is not fixed`).toBe('fixed')
    expect(Math.abs(geom.bottom - geom.vh), `${route} tab bar is not on the bottom edge`).toBeLessThanOrEqual(2)
  })
}

test('no field on a busy Today is under 16px, so iOS never zooms on focus', async ({ page }) => {
  await seedRichDay(page)
  await page.goto('/')
  await settle(page)

  const add = page.getByPlaceholder(/add a task/i).first()
  await expect(add).toBeVisible()
  await add.focus()

  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input, select, textarea'))
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({
        html: el.outerHTML.slice(0, 120),
        px: parseFloat(getComputedStyle(el).fontSize),
      }))
      .filter((f) => f.px < 16),
  )
  expect(small, `fields under 16px:\n${JSON.stringify(small, null, 2)}`).toEqual([])
})

test('the stylesheet honours prefers-reduced-motion', async ({ page }) => {
  await injectGuestState(page)
  await page.goto('/')
  await settle(page)

  const hasRule = await page.evaluate(() =>
    Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes('prefers-reduced-motion'))
      } catch {
        return false // cross-origin sheet (fonts)
      }
    }),
  )
  expect(hasRule, 'no prefers-reduced-motion rule in any stylesheet').toBe(true)
})

test('the tab bar wears the artboard ground (#131518)', async ({ page }) => {
  await injectGuestState(page)
  await page.goto('/')
  await settle(page)

  const bg = await page
    .getByTestId('mobile-tab-bar')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBe('rgb(19, 21, 24)')
})

test('the undo toast sits above the tab bar, not under it', async ({ page }) => {
  await seedRichDay(page)
  await page.goto('/')
  await settle(page)

  // A task with no worked minutes, so deleting it is a plain delete.
  const row = page.locator('div.group').filter({ hasText: 'Buy groceries' }).last()
  await row.getByRole('button', { name: 'Task options' }).click()
  await page.getByRole('menuitem', { name: /^Delete/i }).click()

  const undo = page.getByRole('status').filter({ has: page.getByRole('button', { name: 'Undo' }) })
  await expect(undo).toBeVisible()

  const geom = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="mobile-tab-bar"]')!.getBoundingClientRect()
    const button = Array.from(document.querySelectorAll('[role="status"] button')).find(
      (b) => b.textContent?.trim() === 'Undo',
    )!
    const toast = button.closest('[role="status"]')!
    // The visible card, not the full-width pointer-events-none dock around it.
    const card = (toast.firstElementChild ?? toast).getBoundingClientRect()
    const buttons = Array.from(toast.querySelectorAll('button')).map((b) => Math.round(b.getBoundingClientRect().height))
    return { toastBottom: card.bottom, barTop: bar.top, buttons }
  })

  expect(
    geom.toastBottom,
    `toast ends at ${Math.round(geom.toastBottom)}px, under the tab bar starting at ${Math.round(geom.barTop)}px`,
  ).toBeLessThanOrEqual(geom.barTop)
  for (const h of geom.buttons) expect(h, 'undo toast button under 44px').toBeGreaterThanOrEqual(44)
})

test('the sign-in form on /challenge is thumb-sized', async ({ page }) => {
  await injectGuestState(page)
  await page.goto('/challenge')
  await settle(page)

  await expect(page.locator('#email')).toBeVisible()
  const heights = await page.evaluate(() =>
    ['#email', '#password', 'button[type="submit"]'].map((sel) =>
      Math.round(document.querySelector(sel)!.getBoundingClientRect().height),
    ),
  )
  for (const h of heights) expect(h, 'sign-in field or submit under 48px').toBeGreaterThanOrEqual(48)

  const tiny = await undersizedTouchTargets(page)
  expect(tiny, `/challenge controls under 44px:\n${JSON.stringify(tiny, null, 2)}`).toEqual([])
})
