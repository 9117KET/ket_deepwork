/**
 * e2e/helpers/mobile.ts
 *
 * Shared phone fixtures and measurements for the mobile specs.
 *
 * The seed is deliberately awkward: long titles, a subtask, done rows, a
 * scheduled task, earned minutes. An empty day passes every layout check
 * because there is nothing on it to break; this one has the shapes that do.
 * The measurements return offenders rather than booleans, so a failing test
 * names what to fix.
 */

import type { Page } from '@playwright/test'

/** iPhone 14/15-class context: 390x844, touch as the primary input. */
export const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
} as const

/** Ids in the rich seed, so specs can find a row without matching text. */
export const RICH_IDS = {
  topDone: 'rich-top-done',
  topLong: 'rich-top-long',
  topScheduled: 'rich-top-scheduled',
  listLong: 'rich-list-long',
  listParent: 'rich-list-parent',
  listSubtask: 'rich-list-subtask',
  listDone: 'rich-list-done',
  listTimed: 'rich-list-timed',
  session: 'rich-session-1',
} as const

/** 80 characters exactly, so a row has to wrap or truncate at 390px. */
export const LONG_TITLE_TOP = 'Ship the quarterly planning doc with every open question answered and linked up.'
export const LONG_TITLE_LIST = 'Rewrite the onboarding email sequence so that every message asks for one action.'

/**
 * Seeds today as a guest day with the shapes that break phone layouts:
 *  - Top 3 (`mustDo`): one done, one 90-minute task scheduled at 14:00, one
 *    with an 80-character title;
 *  - Tasks (`highPriority`): an 80-character title, a parent with a subtask,
 *    a done task, a 45-minute task;
 *  - one finished 45-minute earned session against the 90-minute task;
 *  - habit completions keyed by real `DEFAULT_HABIT_DEFINITIONS` ids.
 *
 * Runs before any page script, so call it before `page.goto`.
 */
export async function seedRichDay(page: Page): Promise<void> {
  await page.addInitScript(
    ({ ids, longTop, longList }) => {
      const d = new Date()
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      window.sessionStorage.setItem('deepblock_guest_session', '1')
      window.localStorage.setItem('deepblock_tour_done', '1')
      window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
      window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
      window.sessionStorage.setItem(`shutdown_reminder_shown_${iso}`, '1')

      const started = new Date(d.getTime() - 60 * 60 * 1000)
      const finished = new Date(started.getTime() + 45 * 60 * 1000)

      const task = (id: string, title: string, sectionId: string, extra: Record<string, unknown> = {}) => ({
        id,
        title,
        sectionId,
        date: iso,
        isDone: false,
        ...extra,
      })

      window.localStorage.setItem(
        'deepblock_state_v1',
        JSON.stringify({
          version: 1,
          state: {
            days: {
              [iso]: {
                date: iso,
                tasks: [
                  task(ids.topDone, 'Clear the inbox to zero', 'mustDo', { isDone: true }),
                  task(ids.topScheduled, 'Write the sync design doc', 'mustDo', {
                    durationMinutes: 90,
                    scheduledAt: '14:00',
                  }),
                  task(ids.topLong, longTop, 'mustDo'),
                  task(ids.listLong, longList, 'highPriority'),
                  task(ids.listParent, 'Prepare the trip', 'highPriority'),
                  task(ids.listSubtask, 'Pack the bag', 'highPriority', { parentId: ids.listParent }),
                  task(ids.listDone, 'Book the dentist', 'highPriority', { isDone: true }),
                  task(ids.listTimed, 'Buy groceries', 'highPriority', { durationMinutes: 45 }),
                ],
                deepWorkSessions: [
                  {
                    id: ids.session,
                    label: 'Write the sync design doc',
                    durationMinutes: 45,
                    startedAt: started.toISOString(),
                    finishedAt: finished.toISOString(),
                    taskId: ids.topScheduled,
                  },
                ],
                habitCompletions: {
                  'habit-gym': true,
                  'habit-deep-work': true,
                  'habit-journal': false,
                },
              },
            },
            activeDays: [iso],
          },
        }),
      )
    },
    { ids: RICH_IDS, longTop: LONG_TITLE_TOP, longList: LONG_TITLE_LIST },
  )
}

/**
 * Controls that are too small to hit reliably with a thumb (WCAG 2.5.8 /
 * Apple HIG both land on 44px).
 *
 * Two exceptions are deliberate and are skipped here, because both are carved
 * out by WCAG 2.5.8 itself:
 *  - "inline": a button sitting inside a sentence (the editable "20h" weekly
 *    goal, the "Friday" review day). Padding these to 44px would tear the
 *    prose apart.
 *  - the 31-column month grid, which cannot give every cell 44px on a phone
 *    (that is 1364px of row) and instead lives in a horizontal scroller. Its
 *    cells were still lifted from 24px to 32px on touch.
 */
export async function undersizedTouchTargets(page: Page) {
  return page.evaluate(() => {
    const MIN = 44
    const out: { label: string; size: string; html: string }[] = []
    const selector =
      'button, a, [role=button], input[type=checkbox], select, textarea, input:not([type=hidden]), [role=menuitem], [role=tab], label[for]'
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      if (getComputedStyle(el).visibility === 'hidden') continue
      if (box.height >= MIN && box.width >= MIN) continue

      // A label pointing at a visible, thumb-sized field is a second way to the
      // same control, not the only one. A label for a hidden or small control
      // (a custom checkbox) is the real target and is still measured.
      if (el.tagName === 'LABEL') {
        const forId = el.getAttribute('for')
        const control = forId ? document.getElementById(forId) : null
        const cbox = control?.getBoundingClientRect()
        if (cbox && cbox.width >= MIN && cbox.height >= MIN && getComputedStyle(control!).visibility !== 'hidden') continue
      }

      // Exception: inside a deliberate horizontal scroller (the month grid).
      let parent: Element | null = el.parentElement
      let inScroller = false
      while (parent && parent !== document.body) {
        const overflowX = getComputedStyle(parent).overflowX
        if (overflowX === 'auto' || overflowX === 'scroll') { inScroller = true; break }
        parent = parent.parentElement
      }
      if (inScroller) continue

      // Exception: inline in prose — the parent holds its own text around it.
      const siblingText = Array.from(el.parentElement?.childNodes ?? []).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
      )
      if (siblingText) continue

      out.push({
        label:
          (el as HTMLElement).innerText?.trim().split('\n')[0] ||
          el.getAttribute('aria-label') ||
          el.tagName,
        size: `${Math.round(box.width)}x${Math.round(box.height)}`,
        html: el.outerHTML.slice(0, 140),
      })
    }
    return out
  })
}

/**
 * Distinct visible texts rendered below `minPx`. Reads each text node's
 * parent, since that is what the font size applies to.
 */
export async function tinyTexts(page: Page, minPx = 11): Promise<{ text: string; px: number }[]> {
  return page.evaluate((minPx) => {
    const seen = new Map<string, number>()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim()
      if (!text) continue
      const el = node.parentElement
      if (!el) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      // Screen-reader-only text is clipped to 1px and never seen.
      if (box.width <= 1 && box.height <= 1) continue
      const px = parseFloat(cs.fontSize)
      if (px < minPx && !seen.has(text)) seen.set(text, px)
    }
    return Array.from(seen, ([text, px]) => ({ text: text.slice(0, 60), px }))
  }, minPx)
}

/**
 * Buttons and links that take up room in the layout but cannot be seen:
 * opacity 0 or a transparent text colour. These are hover-only affordances,
 * and a phone has no hover to reveal them.
 */
export async function hiddenControls(page: Page): Promise<{ label: string; reason: string; html: string }[]> {
  return page.evaluate(() => {
    const out: { label: string; reason: string; html: string }[] = []
    for (const el of Array.from(document.querySelectorAll('button, a, [role=button]'))) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      let reason = ''
      if (parseFloat(cs.opacity) === 0) reason = 'opacity 0'
      else if (cs.color === 'transparent' || cs.color === 'rgba(0, 0, 0, 0)') reason = 'transparent text'
      if (!reason) continue
      out.push({
        label:
          (el as HTMLElement).innerText?.trim().split('\n')[0] ||
          el.getAttribute('aria-label') ||
          el.tagName,
        reason,
        html: el.outerHTML.slice(0, 140),
      })
    }
    return out
  })
}
