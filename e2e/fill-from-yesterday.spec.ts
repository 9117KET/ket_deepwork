/**
 * e2e/fill-from-yesterday.spec.ts
 *
 * "Fill from yesterday" (run 2026-11-07, spec 01). Replaces
 * copy-from-day.spec.ts, which pinned the old copy: list only, times kept.
 *
 * The fill now brings yesterday's Top 3 into today's empty Top 3 slots (any
 * left over join Tasks) and yesterday's list, every copy unticked, with its
 * planned length but no scheduled time (a new id has no calendar event) and
 * no legacy logged minutes. No worked minutes are ever created or moved.
 */

import { expect, test, type Page } from '@playwright/test'

type StoredTask = {
  id: string
  title: string
  sectionId: string
  parentId?: string
  isDone: boolean
  scheduledAt?: string
  durationMinutes?: number
  manualLoggedMinutes?: number
}

/** Yesterday as the planner keys it (local date), plus whatever today holds. */
function seed(page: Page, todayTasks: Array<Record<string, unknown>> = [], yesterdayOnlyTop3 = false) {
  return page.addInitScript(({ todayTasks, yesterdayOnlyTop3 }) => {
    const local = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const now = new Date()
    const iso = local(now)
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12)
    const yIso = local(y)
    window.sessionStorage.setItem('deepblock_guest_session', '1')
    window.localStorage.setItem('deepblock_tour_done', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
    window.sessionStorage.setItem(`shutdown_reminder_shown_${iso}`, '1')
    // Seed once per tab: a reload must not undo what the test just did.
    if (window.sessionStorage.getItem('_pw_fill_seeded')) return
    window.sessionStorage.setItem('_pw_fill_seeded', '1')
    const t = (id: string, title: string, sectionId: string, extra: Record<string, unknown> = {}) => ({
      id,
      title,
      sectionId,
      date: yIso,
      isDone: false,
      ...extra,
    })
    window.localStorage.setItem(
      'deepblock_state_v1',
      JSON.stringify({
        version: 1,
        state: {
          days: {
            [yIso]: {
              date: yIso,
              tasks: yesterdayOnlyTop3
                ? [t('y-top-1', 'Ship the draft', 'mustDo'), t('y-top-2', 'Call the bank', 'mustDo')]
                : [
                    t('y-top-1', 'Ship the draft', 'mustDo', { isDone: true }),
                    t('y-top-2', 'Call the bank', 'mustDo'),
                    t('y-top-3', 'Write the review', 'mustDo', {
                      scheduledAt: '09:00',
                      durationMinutes: 60,
                      manualLoggedMinutes: 30,
                    }),
                    t('y-list-1', 'Plan the trip', 'highPriority'),
                    t('y-sub-1', 'Book the train', 'highPriority', { parentId: 'y-list-1' }),
                    t('y-list-2', 'Water the plants', 'highPriority', { isDone: true }),
                  ],
              habitCompletions: {},
              deepWorkSessions: [
                {
                  id: 'y-session-1',
                  label: 'Deep work block',
                  durationMinutes: 45,
                  taskId: 'y-top-3',
                  startedAt: y.toISOString(),
                  finishedAt: y.toISOString(),
                },
              ],
            },
            [iso]: {
              date: iso,
              tasks: (todayTasks as Array<Record<string, unknown>>).map((task) => ({
                isDone: false,
                ...task,
                date: iso,
              })),
              habitCompletions: {},
              deepWorkSessions: [],
            },
          },
        },
      }),
    )
  }, { todayTasks, yesterdayOnlyTop3 })
}

function readDays(page: Page) {
  return page.evaluate(() => {
    const local = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const now = new Date()
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12)
    const days = JSON.parse(window.localStorage.getItem('deepblock_state_v1') ?? '{}').state?.days ?? {}
    return {
      today: (days[local(now)]?.tasks ?? []) as StoredTask[],
      todaySessions: (days[local(now)]?.deepWorkSessions ?? []) as unknown[],
      yesterday: (days[local(y)]?.tasks ?? []) as StoredTask[],
      yesterdaySessions: (days[local(y)]?.deepWorkSessions ?? []) as unknown[],
    }
  })
}

const rootTitles = (tasks: StoredTask[], sectionId: string) =>
  tasks.filter((t) => t.sectionId === sectionId && !t.parentId).map((t) => t.title)

async function open(page: Page) {
  await page.goto('/')
  await expect(page.locator('[data-tour="date-nav"]')).toBeVisible({ timeout: 40_000 })
}

test.describe('Fill from yesterday', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false })

  test('an empty day gets yesterday’s Top 3 and list, unticked, without times or logged minutes', async ({ page }) => {
    await seed(page)
    await open(page)
    const before = await readDays(page)

    await page.getByRole('button', { name: 'Fill from yesterday' }).click()
    await expect.poll(async () => (await readDays(page)).today.length).toBe(6)

    const { today, todaySessions, yesterday, yesterdaySessions } = await readDays(page)
    expect(rootTitles(today, 'mustDo')).toEqual(['Ship the draft', 'Call the bank', 'Write the review'])
    expect(rootTitles(today, 'highPriority')).toEqual(['Plan the trip', 'Water the plants'])

    for (const task of today) {
      expect(task.isDone).toBe(false)
      expect('scheduledAt' in task).toBe(false)
      expect('manualLoggedMinutes' in task).toBe(false)
      expect(task.id.startsWith('y-')).toBe(false)
    }
    // The planned length is still the plan.
    expect(today.find((t) => t.title === 'Write the review')?.durationMinutes).toBe(60)
    // The subtask follows its copied parent.
    const parent = today.find((t) => t.title === 'Plan the trip')!
    expect(today.find((t) => t.title === 'Book the train')).toMatchObject({
      parentId: parent.id,
      sectionId: 'highPriority',
    })

    // Worked minutes are sacred: nothing created today, nothing taken from yesterday.
    expect(todaySessions).toEqual([])
    expect(yesterdaySessions).toEqual(before.yesterdaySessions)
    expect(yesterday).toEqual(before.yesterday)

    // One gesture, one Undo.
    await expect(page.getByText('Copied from yesterday')).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await readDays(page)).today.length).toBe(0)
  })

  test('with one Top 3 set, the fill adds two and sends the third to Tasks', async ({ page }) => {
    await seed(page, [{ id: 'mine', title: 'My own priority', sectionId: 'mustDo' }])
    await open(page)

    await page.getByRole('button', { name: 'Fill from yesterday' }).click()
    await expect.poll(async () => (await readDays(page)).today.length).toBe(7)

    const { today } = await readDays(page)
    expect(rootTitles(today, 'mustDo')).toEqual(['My own priority', 'Ship the draft', 'Call the bank'])
    expect(rootTitles(today, 'highPriority').sort()).toEqual(
      ['Plan the trip', 'Water the plants', 'Write the review'].sort(),
    )
    expect(today.filter((t) => t.sectionId === 'mustDo' && !t.parentId)).toHaveLength(3)
  })

  test('a day that already has a list is not offered the fill', async ({ page }) => {
    await seed(page, [{ id: 'own', title: 'Something of my own', sectionId: 'highPriority' }])
    await open(page)
    await expect(page.getByText('Something of my own')).toBeVisible()
    await expect(page.getByRole('button', { name: /Fill from|Copy from/ })).toHaveCount(0)
  })

  test('a fill with nothing new is not offered, so it leaves no empty Undo', async ({ page }) => {
    // Yesterday held only a Top 3, and today already has the same two.
    await seed(
      page,
      [
        { id: 'a', title: 'ship the draft ', sectionId: 'mustDo' },
        { id: 'b', title: 'Call the bank', sectionId: 'mustDo' },
      ],
      true,
    )
    await open(page)
    await expect(page.getByText('Call the bank')).toBeVisible()
    await expect(page.getByRole('button', { name: /Fill from|Copy from/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  })
})
