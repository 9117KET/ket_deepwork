/**
 * e2e/dnd-crash-repro.spec.ts  (TEMPORARY — diagnostic repro for the DnD crash)
 *
 * Seeds a day with several High Priority tasks, then performs a native HTML5
 * drag-and-drop reorder while listening for uncaught errors and watching whether
 * the app tree blanks. Goal: capture the real stack of the reported crash.
 */

import { test, expect, type Page } from '@playwright/test'

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

async function dismissModals(page: Page) {
  const skipBtn = page.getByRole('button', { name: 'Skip for today' })
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click()
  }
}

function seed(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const mk = (section: string, i: number, extra: Record<string, unknown> = {}) => ({
      id: `pw-${section}-${i}`,
      title: `${section} task ${i + 1}`,
      sectionId: section,
      date: today,
      isDone: false,
      ...extra,
    })
    const tasks = [
      mk('highPriority', 0, { durationMinutes: 60 }),
      mk('highPriority', 1, { durationMinutes: 30 }),
      mk('highPriority', 2),
      // a parent with a subtask, to exercise the subtask path too
      { id: 'pw-parent', title: 'Parent', sectionId: 'mediumPriority', date: today, isDone: false },
      { id: 'pw-child', title: 'Child', sectionId: 'mediumPriority', date: today, isDone: false, parentId: 'pw-parent' },
      mk('mediumPriority', 9),
    ]
    const appState = {
      days: {
        [today]: {
          date: today,
          tasks,
          habitCompletions: {},
          deepWorkSessions: [],
          wakeTime: '07:00',
          sleepTarget: '23:00',
          bedTime: '22:30',
          shutdownCompletedAt: new Date().toISOString(),
        },
      },
    }
    window.localStorage.setItem('deepblock_state_v1', JSON.stringify({ version: 1, state: appState }))
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
  })
}

/** Fire a native HTML5 drag sequence between two grips (by index) using a shared DataTransfer. */
async function html5Drag(page: Page, fromIdx: number, toIdx: number) {
  await page.evaluate(
    ({ fromIdx, toIdx }) => {
      const grips = Array.from(
        document.querySelectorAll('[aria-label="Drag to reorder; right-click for menu"]'),
      )
      const from = grips[fromIdx]
      // Drop onto the task ROW that contains the target grip (the row holds onDrop).
      const to = grips[toIdx]?.closest('.group') ?? grips[toIdx]
      if (!from || !to) throw new Error(`drag grips not found: ${fromIdx} / ${toIdx} (have ${grips.length})`)
      const dt = new DataTransfer()
      const rectFrom = from.getBoundingClientRect()
      const rectTo = to.getBoundingClientRect()
      const fire = (el: Element, type: string, x: number, y: number) => {
        const ev = new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
        Object.defineProperty(ev, 'dataTransfer', { value: dt })
        el.dispatchEvent(ev)
      }
      fire(from, 'dragstart', rectFrom.x + 5, rectFrom.y + 5)
      fire(to, 'dragenter', rectTo.x + 5, rectTo.y + rectTo.height - 2)
      fire(to, 'dragover', rectTo.x + 5, rectTo.y + rectTo.height - 2)
      fire(to, 'drop', rectTo.x + 5, rectTo.y + rectTo.height - 2)
      fire(from, 'dragend', rectTo.x + 5, rectTo.y + rectTo.height - 2)
    },
    { fromIdx, toIdx },
  )
}

test('repro: drag a high-priority task and capture any crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}\n${err.stack ?? ''}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`CONSOLE.ERROR: ${msg.text()}`)
  })

  await seed(page)
  await openPlanner(page)
  await dismissModals(page)

  await expect(page.getByText('highPriority task 1')).toBeVisible({ timeout: 10_000 })

  // Expand the Medium Priority section (starts collapsed) so a cross-section drop
  // target exists. Click its specific section header toggle once.
  const medium = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Medium Priority (Supplementary Tasks)' }) })
    .first()
  await medium.getByRole('button', { name: 'Expand section' }).click().catch(() => {})
  await page.waitForTimeout(300)

  const gripSel = '[aria-label="Drag to reorder; right-click for menu"]'
  const gripCount = async () => page.locator(gripSel).count()
  console.log('GRIP COUNT:', await gripCount())

  const check = async (label: string) => {
    await page.waitForTimeout(400)
    const mounted = await page.locator('[data-tour="date-nav"]').count()
    console.log(`[${label}] STILL MOUNTED: ${mounted} | grips: ${await gripCount()} | errors: ${errors.length}`)
    if (errors.length) console.log(`[${label}] ERRORS:\n` + errors.join('\n---\n'))
    expect(mounted, `${label}\n` + errors.join('\n---\n')).toBeGreaterThan(0)
  }

  // 1) in-section reorder (first grip onto third row)
  await html5Drag(page, 0, 2)
  await check('in-section reorder')

  // 2) cross-section: drag first grip (High) onto a Medium-section row (a later grip)
  const total = await gripCount()
  await html5Drag(page, 0, total - 1)
  await check('cross-section move')

  // 3) drag onto the parent row (cross into the parent/subtask block)
  await html5Drag(page, 0, 1)
  await check('onto parent row')

  console.log('FINAL ERRORS:\n' + (errors.join('\n---\n') || '(none)'))
})

test('verify: sleep card is demand-derived and sidebar is consolidated', async ({ page }) => {
  // Seed a realistically full day so the night block ends in the evening and the
  // sleep window is the normal (non-capped) "block end + wind-down" case.
  await page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const tasks = [
      { id: 'm0', title: 'Morning routine', sectionId: 'morningRoutine', date: today, isDone: false, durationMinutes: 60 },
      { id: 'h0', title: 'Deep work', sectionId: 'highPriority', date: today, isDone: false, durationMinutes: 480 },
      { id: 'md0', title: 'Admin', sectionId: 'mediumPriority', date: today, isDone: false, durationMinutes: 180 },
      { id: 'lo0', title: 'Errand', sectionId: 'lowPriority', date: today, isDone: false, durationMinutes: 120 },
      { id: 'n0', title: 'Night routine', sectionId: 'nightRoutine', date: today, isDone: false, durationMinutes: 60 },
    ]
    const appState = {
      days: {
        [today]: {
          date: today, tasks, habitCompletions: {}, deepWorkSessions: [],
          wakeTime: '07:00', sleepTarget: '23:00', bedTime: '22:30',
          shutdownCompletedAt: new Date().toISOString(),
        },
      },
    }
    window.localStorage.setItem('deepblock_state_v1', JSON.stringify({ version: 1, state: appState }))
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
  })
  await openPlanner(page)
  await dismissModals(page)

  // Sleep card: derived from the last block end + wind-down buffer, not a fixed bedtime.
  const sleep = page
    .locator('section[aria-label="Sleep block"]')
    .first()
  await expect(sleep).toBeVisible({ timeout: 10_000 })
  await expect(sleep).toContainText('after 20m wind-down')
  await expect(sleep).toContainText('→')
  console.log('SLEEP CARD:', (await sleep.innerText()).replace(/\n+/g, ' | '))

  // Sidebar: consolidated "Focus" card exists; "Motivation" is no longer a standalone card.
  await expect(page.getByRole('button', { name: /Focus/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Collapse Motivation' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Expand Motivation' })).toHaveCount(0)
  // Low-use cards start collapsed (expand affordance present).
  await expect(page.getByRole('button', { name: 'Expand Not doing' })).toBeVisible()
})
