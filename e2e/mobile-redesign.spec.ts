/**
 * e2e/mobile-redesign.spec.ts
 *
 * Gates the mobile redesign — the four destinations from `docs/design/mobile/`.
 *
 * The measured problem these screens exist to fix: every tab rendered the same
 * ~2,500px of dashboard and only ~700px actually swapped, so the tab bar
 * partitioned nothing. Two of the tests below are that measurement, kept as a
 * gate: no tab may render the monthly dashboard, and the Today tab must not
 * grow back into a four-screen scroll. They are the ones that fail first if
 * someone reintroduces a month-scale card onto the day.
 *
 * The rest pin the shape of each screen: Today is one "Tasks" list with every
 * open task one tap from the calendar (there is no NOW card since the minimal
 * rewrite), Focus is the countdown alone once a block runs, Habits shows seven
 * days per row,
 * Review summarises and keeps the heavy content behind a tap.
 */

import { expect, test, type Page } from '@playwright/test'

const PHONE = { width: 390, height: 844 }

function seed(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('deepblock_tour_done', '1')
    const d = new Date()
    const iso = (dd: Date) =>
      `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
    const today = iso(d)
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
    // The planner auto-opens the shutdown ritual (a full-screen overlay that
    // swallows clicks) from 9 PM local time. Key must match todayIso().
    window.sessionStorage.setItem(`shutdown_reminder_shown_${today}`, '1')

    // Put the clock inside the High Priority block so the NOW card has a task.
    const now = d.getHours() * 60 + d.getMinutes()
    const wake = Math.max(0, now - 45)
    const wakeTime = `${String(Math.floor(wake / 60)).padStart(2, '0')}:${String(wake % 60).padStart(2, '0')}`

    const days: Record<string, unknown> = {}
    // Yesterday kept "Deep work" and missed "Gym", so Gym is at risk today
    // (never-miss-twice) and its week shows a broken chain.
    const yesterday = new Date(d)
    yesterday.setDate(d.getDate() - 1)
    const dayBefore = new Date(d)
    dayBefore.setDate(d.getDate() - 2)
    days[iso(dayBefore)] = {
      date: iso(dayBefore),
      tasks: [],
      deepWorkSessions: [],
      habitCompletions: { 'habit-deep-work': true, 'habit-gym': true },
    }
    days[iso(yesterday)] = {
      date: iso(yesterday),
      tasks: [],
      deepWorkSessions: [
        { id: 'y1', label: 'Deep work', durationMinutes: 120, startedAt: yesterday.toISOString(), finishedAt: yesterday.toISOString() },
      ],
      habitCompletions: { 'habit-deep-work': true, 'habit-gym': false },
    }

    days[today] = {
      date: today,
      wakeTime,
      sleepTarget: '23:00',
      dayNote: 'Today went to the sync doc.',
      habitCompletions: { 'habit-deep-work': true },
      deepWorkSessions: [
        { id: 's1', label: 'Write the sync design doc', durationMinutes: 90, startedAt: d.toISOString(), finishedAt: d.toISOString(), taskId: 'k-1' },
      ],
      blockDurations: { morningRoutine: 30, highPriority: 240, mediumPriority: 60, lowPriority: 40, nightRoutine: 60 },
      tasks: [
        { id: 'k-1', title: 'Write the sync design doc', sectionId: 'highPriority', date: today, isDone: false, durationMinutes: 135 },
        { id: 'k-2', title: 'Ship the responsive audit', sectionId: 'highPriority', date: today, isDone: false, durationMinutes: 60 },
        { id: 'k-3', title: 'Reply to the funding email', sectionId: 'mediumPriority', date: today, isDone: false, durationMinutes: 20 },
        { id: 'k-4', title: 'Lay out tomorrow', sectionId: 'nightRoutine', date: today, isDone: false, durationMinutes: 15 },
      ],
    }

    window.localStorage.setItem(
      'deepblock_state_v1',
      JSON.stringify({
        version: 1,
        state: {
          days,
          identityStatement: 'someone who does the hard thing first',
          focusBlockMinutes: 45,
          deepWorkGoalHoursPerWeek: 20,
        },
      }),
    )
  })
}

async function openPlanner(page: Page, path = '/') {
  await page.setViewportSize(PHONE)
  await seed(page)
  await page.goto(path)
  await page.waitForFunction(
    () => {
      if (document.querySelector('[data-tour="date-nav"]')) return true
      // Lowercased on purpose: these labels are uppercased with CSS, and
      // innerText returns the *rendered* text, so an authored-case match fails.
      if (document.body.innerText.toLowerCase().includes('this week')) return true
      const guest = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Continue as guest',
      )
      if (guest) (guest as HTMLButtonElement).click()
      return false
    },
    { timeout: 40_000, polling: 400 },
  )
  await page.waitForTimeout(600)
}

/**
 * The tab bar's control for a destination. Scoped to the bar: "Today" also
 * names the day header's Today/Review toggle, and an unscoped locator matches
 * both.
 */
function tab(page: Page, name: 'Today' | 'Focus' | 'Habits' | 'Review') {
  return page
    .getByTestId('mobile-tab-bar')
    .getByRole(name === 'Review' ? 'link' : 'button', { name, exact: true })
}

test.describe('mobile destinations', () => {
  test('the tab bar offers exactly the four destinations', async ({ page }) => {
    await openPlanner(page)
    for (const name of ['Today', 'Focus', 'Habits', 'Review'] as const) {
      await expect(tab(page, name)).toBeVisible()
    }
    // The Stats tab is gone; Review replaced it and is a route.
    await expect(
      page.getByTestId('mobile-tab-bar').getByRole('button', { name: 'Stats', exact: true }),
    ).toHaveCount(0)
    await expect(tab(page, 'Review')).toHaveAttribute('href', '/review')
  })

  test('no tab renders the monthly dashboard — the reason the bar partitions anything', async ({ page }) => {
    await openPlanner(page)
    for (const name of ['Today', 'Focus', 'Habits'] as const) {
      await tab(page, name).click()
      await page.waitForTimeout(350)
      await expect(
        page.getByText('Monthly tracking', { exact: false }),
        `${name} must not render the month-scale dashboard`,
      ).toHaveCount(0)
      await expect(page.getByText('Block completion rate')).toHaveCount(0)
    }
  })

  test('the Today tab fits in roughly one screen of scrolling, not four', async ({ page }) => {
    await openPlanner(page)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    // Measured at 3,273px before the redesign, with fewer tasks than seeded here.
    expect(height).toBeLessThan(2200)
  })

  test('Today shows one task list, each open task one tap from the calendar', async ({ page }) => {
    await openPlanner(page)
    await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
    await expect(page.locator('label').getByText('Write the sync design doc', { exact: true })).toBeVisible()
    // Days planned before the rewrite keep their old sections rather than hiding tasks.
    await expect(page.locator('label').getByText('Reply to the funding email', { exact: true })).toBeVisible()
    expect(await page.getByRole('button', { name: 'Schedule in calendar' }).count()).toBeGreaterThan(0)
  })

  test('Focus shows the setup card when idle and the countdown alone once running', async ({ page }) => {
    await openPlanner(page)
    await tab(page, 'Focus').click()
    await expect(page.getByTestId('mobile-focus-idle')).toBeVisible()

    // A task's own progress row is the way into a block.
    await tab(page, 'Today').click()
    await page.getByRole('button', { name: /Start (a [0-9]+m|the next) block on this task/ }).first().click()
    await tab(page, 'Focus').click()

    const running = page.getByTestId('mobile-focus-running')
    await expect(running).toBeVisible()
    await expect(running).toContainText('Working on')
    await expect(running).toContainText('Write the sync design doc')
    await expect(running).toContainText('of a 45 minute block')
    await expect(running.getByRole('button', { name: 'Pause block' })).toBeVisible()
    // The setup card is not also on screen.
    await expect(page.getByTestId('mobile-focus-idle')).toHaveCount(0)
  })

  test('Focus keeps the minutes worked when you finish early', async ({ page }) => {
    await openPlanner(page)
    await page.getByRole('button', { name: /Start (a [0-9]+m|the next) block on this task/ }).first().click()
    await tab(page, 'Focus').click()
    await expect(page.getByTestId('mobile-focus-running')).toBeVisible()

    // Under a minute of work banks nothing, so this returns to idle rather than
    // inventing a session — but it must never lose an existing one.
    const before = await page.evaluate(() => {
      const raw = window.localStorage.getItem('deepblock_state_v1')
      const today = new Date()
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      return JSON.parse(raw!).state.days[iso].deepWorkSessions.length
    })
    await page.getByRole('button', { name: 'Finish early and keep the minutes worked' }).click()
    await page.waitForTimeout(500)
    const after = await page.evaluate(() => {
      const raw = window.localStorage.getItem('deepblock_state_v1')
      const today = new Date()
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      return JSON.parse(raw!).state.days[iso].deepWorkSessions.length
    })
    expect(after).toBeGreaterThanOrEqual(before)
  })

  test('Habits shows identity, a seven-day row per habit, and the never-miss-twice flag', async ({ page }) => {
    await openPlanner(page)
    await tab(page, 'Habits').click()

    const panel = page.getByTestId('mobile-habits')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('I am')
    await expect(panel).toContainText('someone who does the hard thing first')
    await expect(panel).toContainText('Last 7 days')

    // Gym was kept two days ago and missed yesterday, so it is at risk today.
    await expect(panel).toContainText('missed yesterday')
  })

  test('Habits toggles persist', async ({ page }) => {
    await openPlanner(page)
    await tab(page, 'Habits').click()
    const gym = page.getByRole('button', { name: /^Check Gym$/ })
    await gym.click()
    await page.waitForTimeout(400)
    await expect(page.getByRole('button', { name: /^Uncheck Gym$/ })).toBeVisible()
  })

  test('Review is one short screen: the week, the goal, the habits', async ({ page }) => {
    await openPlanner(page, '/review')
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible()
    await expect(page.getByLabel('Weekly deep work goal in hours')).toBeVisible()
    await expect(page.getByText('Monthly tracking')).toHaveCount(0)
  })

  test('the tab bar carries the chosen tab back from Review to the planner', async ({ page }) => {
    await openPlanner(page, '/review')
    await tab(page, 'Habits').click()
    await expect(page).toHaveURL(/\/\?tab=habits/)
    await expect(page.getByTestId('mobile-habits')).toBeVisible()
  })
})
