/**
 * e2e/work-safety.spec.ts
 *
 * The failure this suite exists for, in the order it actually happened:
 * delete a task you meant to keep, copy it back from yesterday, and discover
 * the running block is now unusable — with "reset it" the only way forward and
 * the elapsed minutes gone.
 *
 * Every test here asserts the same thing from a different angle: recorded work
 * survives an ordinary mistake.
 */

import { test, expect, type Page } from '@playwright/test'

const STATE_KEY = 'deepblock_state_v1'
const BLOCK_KEY = 'deepblock_active_block_v1'

interface SeedTask {
  id: string
  title: string
  sectionId: string
  isDone?: boolean
  durationMinutes?: number
  manualLoggedMinutes?: number
  parentId?: string
}

interface SeedSession {
  id: string
  label: string
  durationMinutes: number
  taskId?: string
  startedAt?: string
}

interface SeedOptions {
  tasks?: SeedTask[]
  sessions?: SeedSession[]
  /** A block mirrored to localStorage as if it were mid-run. */
  activeBlock?: { taskId?: string; totalMinutes: number; minutesLeft: number; label?: string }
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function seed(page: Page, opts: SeedOptions = {}) {
  await page.addInitScript(
    ([stateKey, blockKey, options]) => {
      const o = options as SeedOptions
      const d = new Date()
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      localStorage.setItem('deepblock_tour_done', '1')
      sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
      sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
      sessionStorage.setItem(`shutdown_reminder_shown_${iso}`, '1')

      localStorage.setItem(
        stateKey as string,
        JSON.stringify({
          version: 1,
          state: {
            days: {
              [iso]: {
                date: iso,
                tasks: (o.tasks ?? []).map((t) => ({ ...t, date: iso, isDone: t.isDone ?? false })),
                deepWorkSessions: (o.sessions ?? []).map((s) => ({
                  ...s,
                  startedAt: s.startedAt ?? new Date().toISOString(),
                })),
                habitCompletions: {},
                wakeTime: '07:00',
                sleepTarget: '23:00',
                bedTime: '22:30',
              },
            },
            activeDays: [iso],
          },
        }),
      )

      if (o.activeBlock) {
        localStorage.setItem(
          blockKey as string,
          JSON.stringify({
            dayIso: iso,
            taskId: o.activeBlock.taskId,
            label: o.activeBlock.label ?? 'Deep work block',
            totalMinutes: o.activeBlock.totalMinutes,
            startedAt: new Date(
              Date.now() - (o.activeBlock.totalMinutes - o.activeBlock.minutesLeft) * 60_000,
            ).toISOString(),
            status: 'running',
            endsAt: Date.now() + o.activeBlock.minutesLeft * 60_000,
            remainingMs: 0,
          }),
        )
      }
    },
    [STATE_KEY, BLOCK_KEY, opts] as const,
  )
}

async function openPlanner(page: Page) {
  await page.goto('/planner')
  await page.waitForLoadState('networkidle').catch(() => {})
  const guest = page.getByRole('button', { name: 'Continue as guest' })
  if (await guest.isVisible({ timeout: 3_000 }).catch(() => false)) await guest.click()
  const skip = page.getByRole('button', { name: 'Skip for today' })
  if (await skip.isVisible({ timeout: 3_000 }).catch(() => false)) await skip.click()
  await page.waitForTimeout(600)
}

/** The persisted planner state, as the app would reload it. */
async function readState(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw).state : null
  }, STATE_KEY)
}

// ─────────────────────────────────────────────────────────────────────────────

test('deleting a task keeps the deep work minutes it was worked for', async ({ page }) => {
  await seed(page, {
    tasks: [{ id: 't1', title: 'Study German', sectionId: 'highPriority', durationMinutes: 90 }],
    sessions: [{ id: 's1', label: 'Deep work block', durationMinutes: 45, taskId: 't1' }],
  })
  await openPlanner(page)

  // On a desktop viewport the row's menu opens by right-clicking the grip; the
  // kebab button is hover-only and hidden for reorderable rows.
  await page.getByLabel('Drag to reorder; right-click for menu').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: /^Delete/i }).click()
  await page.waitForTimeout(600)

  const state = await readState(page)
  const day = state.days[todayIso()]

  // The task is gone...
  expect(day.tasks.find((t: SeedTask) => t.id === 't1')).toBeUndefined()
  // ...but the 45 minutes are not.
  expect(day.deepWorkSessions).toHaveLength(1)
  expect(day.deepWorkSessions[0].durationMinutes).toBe(45)
  // Detached rather than dangling, and the record still says what it was for.
  expect(day.deepWorkSessions[0].taskId).toBeUndefined()
  expect(day.deepWorkSessions[0].label).toContain('Study German')
})

test('stopping a running block offers to keep the minutes instead of binning them', async ({ page }) => {
  await seed(page, {
    tasks: [{ id: 't1', title: 'Study German', sectionId: 'highPriority', durationMinutes: 90 }],
    // 45 minute block with 14 left: 31 minutes already earned.
    activeBlock: { taskId: 't1', totalMinutes: 45, minutesLeft: 14 },
  })
  await openPlanner(page)

  const stop = page.getByRole('button', { name: 'Stop', exact: true }).first()
  await expect(stop).toBeVisible()
  await stop.click()

  // The choice is offered rather than the work silently dropped.
  const keep = page.getByRole('button', { name: /Keep .* and stop/ }).first()
  await expect(keep).toBeVisible()
  await expect(page.getByRole('button', { name: 'Discard', exact: true }).first()).toBeVisible()

  await keep.click()
  await page.waitForTimeout(600)

  const day = (await readState(page)).days[todayIso()]
  expect(day.deepWorkSessions.length).toBeGreaterThanOrEqual(1)
  const banked = day.deepWorkSessions[day.deepWorkSessions.length - 1]
  // 31 minutes, give or take the second the test spent clicking.
  expect(banked.durationMinutes).toBeGreaterThanOrEqual(30)
  expect(banked.durationMinutes).toBeLessThanOrEqual(31)
  expect(banked.taskId).toBe('t1')
})

test('a block untouched since it started still resets in one click', async ({ page }) => {
  await seed(page, {
    tasks: [{ id: 't1', title: 'Study German', sectionId: 'highPriority' }],
    // Nothing meaningful elapsed - no reason to interrupt anyone.
    activeBlock: { taskId: 't1', totalMinutes: 45, minutesLeft: 45 },
  })
  await openPlanner(page)

  await page.getByRole('button', { name: 'Stop', exact: true }).first().click()
  await page.waitForTimeout(400)

  await expect(page.getByRole('button', { name: /Keep .* and stop/ })).toHaveCount(0)
  const day = (await readState(page)).days[todayIso()]
  expect(day.deepWorkSessions ?? []).toHaveLength(0)
})

test('the busy notice names a way out that does not destroy the block', async ({ page }) => {
  await seed(page, {
    tasks: [
      { id: 't1', title: 'Study German', sectionId: 'highPriority', durationMinutes: 90 },
      { id: 't2', title: 'Write the doc', sectionId: 'highPriority', durationMinutes: 90 },
    ],
    activeBlock: { taskId: 't1', totalMinutes: 45, minutesLeft: 14 },
  })
  await openPlanner(page)

  // Try to start a second block from the other task's progress row.
  const started = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /start/i.test(b.getAttribute('title') ?? b.getAttribute('aria-label') ?? ''),
    )
    if (!btn) return false
    ;(btn as HTMLButtonElement).click()
    return true
  })

  if (started) {
    await page.waitForTimeout(400)
    const body = await page.locator('body').innerText()
    if (/already running/i.test(body)) {
      // Whatever it says, it must not tell them to reset - that was the trap.
      expect(body).not.toMatch(/reset it first/i)
    }
  }

  // The running block is untouched either way.
  const stillRunning = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.status,
    BLOCK_KEY,
  )
  expect(stillRunning).toBe('running')
})

test('a session started today is credited to today even after paging to yesterday', async ({ page }) => {
  await seed(page, {
    tasks: [{ id: 't1', title: 'Study German', sectionId: 'highPriority', durationMinutes: 90 }],
    // Two seconds left: it lands while we are looking at yesterday.
    activeBlock: { taskId: 't1', totalMinutes: 45, minutesLeft: 0.05 },
  })
  await openPlanner(page)

  const today = todayIso()
  await page.getByRole('button', { name: 'Previous day', exact: true }).first().click()
  await page.waitForTimeout(4_000) // let the block land while yesterday is on screen

  const state = await readState(page)
  const yesterday = new Date(Date.now() - 86_400_000)
  const yIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  const todaySessions = state.days[today]?.deepWorkSessions ?? []
  const yesterdaySessions = state.days[yIso]?.deepWorkSessions ?? []

  expect(
    todaySessions.length,
    'the block started today, so its minutes belong to today',
  ).toBeGreaterThanOrEqual(1)
  expect(
    yesterdaySessions.length,
    'yesterday was already closed - nothing may be written onto it',
  ).toBe(0)
})

test('deleting a task with hand-logged minutes asks first, and cancelling keeps it', async ({ page }) => {
  await seed(page, {
    tasks: [
      {
        id: 't1',
        title: 'Study German',
        sectionId: 'highPriority',
        durationMinutes: 90,
        // Logged by hand: this lives on the task and has no other record.
        manualLoggedMinutes: 50,
      },
    ],
  })
  await openPlanner(page)

  let asked = ''
  page.on('dialog', (d) => {
    asked = d.message()
    void d.dismiss() // the user changes their mind
  })

  await page.getByLabel('Drag to reorder; right-click for menu').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: /^Delete/i }).click()
  await page.waitForTimeout(600)

  expect(asked, 'deleting hand-logged work must ask first').toMatch(/50m/)
  expect(asked).toMatch(/logged by hand/i)

  // Cancelled, so the task and its minutes are still there.
  const day = (await readState(page)).days[todayIso()]
  expect(day.tasks.find((t: SeedTask) => t.id === 't1')?.manualLoggedMinutes).toBe(50)
})

test('deleting a task with only timed work does not raise a false alarm', async ({ page }) => {
  await seed(page, {
    tasks: [{ id: 't1', title: 'Study German', sectionId: 'highPriority', durationMinutes: 90 }],
    // Timed sessions survive deletion on their own, so there is nothing to warn about.
    sessions: [{ id: 's1', label: 'Deep work block', durationMinutes: 45, taskId: 't1' }],
  })
  await openPlanner(page)

  let asked = false
  page.on('dialog', (d) => {
    asked = true
    void d.accept()
  })

  await page.getByLabel('Drag to reorder; right-click for menu').first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: /^Delete/i }).click()
  await page.waitForTimeout(600)

  expect(asked, 'a warning that overstates the damage trains people to click through it').toBe(false)
  const day = (await readState(page)).days[todayIso()]
  expect(day.tasks).toHaveLength(0)
  expect(day.deepWorkSessions).toHaveLength(1)
})
