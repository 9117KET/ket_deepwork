/**
 * e2e/touch-reorder.spec.ts
 *
 * Moving a task anywhere on Today (run 2026-11-02, spec 02).
 *
 * On a phone a row lifts after a press and hold and can be dropped between
 * rows of either list; an ordinary swipe still scrolls. The ⋮ sheet moves a
 * task between the Top 3 and Tasks without any gesture. On a desktop the mouse
 * drag keeps working, never starts on a checkbox, lands in an empty Top 3, and
 * the grip answers Alt+ArrowUp / Alt+ArrowDown.
 *
 * Touches go through CDP (`Input.dispatchTouchEvent`), which drives Chromium's
 * real input pipeline: pointer events, touch events and scrolling.
 */

import { expect, test, type Locator, type Page } from '@playwright/test'
import { LONG_TITLE_LIST, PHONE, RICH_IDS, seedRichDay } from './helpers/mobile'

const SHOTS =
  process.env.TOUCH_REORDER_SHOTS ??
  'C:/Users/kinlo/AppData/Local/Temp/claude/C--Users-kinlo-code-personal-ket-deepwork/efe18ce6-3a6f-4b29-b6bd-400c7f9fd474/scratchpad'

type StoredTask = { id: string; title: string; sectionId: string; parentId?: string }

/** Today's tasks and sessions as stored, in stored order. */
function readDay(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('deepblock_state_v1')
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const day = raw ? JSON.parse(raw).state?.days?.[iso] : null
    return {
      tasks: (day?.tasks ?? []) as { id: string; title: string; sectionId: string; parentId?: string }[],
      sessions: (day?.deepWorkSessions ?? []) as unknown[],
    }
  })
}

/** Root ids of one section, in stored order. */
async function rootsOf(page: Page, sectionId: string) {
  const { tasks } = await readDay(page)
  return tasks.filter((t: StoredTask) => t.sectionId === sectionId && !t.parentId).map((t: StoredTask) => t.id)
}

function row(page: Page, taskId: string) {
  return page.locator(`[data-task-id="${taskId}"]`).first()
}

async function center(loc: Locator, yFraction = 0.5) {
  const box = await loc.boundingBox()
  if (!box) throw new Error('not visible')
  return { x: Math.round(box.x + box.width * 0.6), y: Math.round(box.y + box.height * yFraction) }
}

/** A finger on the screen, driven through CDP. */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  let at = { x: 0, y: 0 }
  return {
    async down(p: { x: number; y: number }) {
      at = p
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] })
    },
    async moveTo(p: { x: number; y: number }, steps = 12) {
      const from = at
      for (let i = 1; i <= steps; i++) {
        const x = Math.round(from.x + ((p.x - from.x) * i) / steps)
        const y = Math.round(from.y + ((p.y - from.y) * i) / steps)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
        await page.waitForTimeout(16)
      }
      at = p
    },
    async up() {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    },
  }
}

/** Press and hold `from`, then drag to `to` and lift. */
async function holdAndDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const f = await finger(page)
  await f.down(from)
  await page.waitForTimeout(450)
  await f.moveTo(to)
  await page.waitForTimeout(80)
  await f.up()
  await page.waitForTimeout(250)
}

async function openToday(page: Page) {
  await seedRichDay(page)
  await page.goto('/')
  await expect(page.locator('[data-tour="date-nav"]')).toBeVisible({ timeout: 40_000 })
  await expect(page.getByText(LONG_TITLE_LIST)).toBeVisible()
}

async function openActions(page: Page, taskId: string) {
  await row(page, taskId).getByRole('button', { name: 'Task options' }).first().click()
  const sheet = page.getByTestId('task-action-sheet')
  await expect(sheet).toBeVisible()
  return sheet
}

test.describe('phone', () => {
  test.use(PHONE)

  test('hold and drag a Tasks row into the Top 3; worked minutes untouched', async ({ page }) => {
    await openToday(page)
    // The seed fills the Top 3, which holds at most three: make room first.
    const making = await openActions(page, RICH_IDS.topLong)
    await making.getByRole('menuitem', { name: 'Move to Tasks' }).click()
    await expect.poll(() => rootsOf(page, 'mustDo')).toEqual([RICH_IDS.topDone, RICH_IDS.topScheduled])
    const before = await readDay(page)

    // Both rows on screen: the Tasks row near the bottom, the Top 3 above.
    await row(page, RICH_IDS.listTimed).scrollIntoViewIfNeeded()
    const from = await center(row(page, RICH_IDS.listTimed).locator('button').first())
    // Upper half of the second Top 3 row: land between the first and second.
    const to = await center(row(page, RICH_IDS.topScheduled), 0.2)

    const f = await finger(page)
    await f.down(from)
    await page.waitForTimeout(450)
    await f.moveTo(to)
    await page.waitForTimeout(120)
    // The lifted row and the insertion line, mid-gesture (a viewport shot:
    // a full-page one drops touch emulation).
    await expect(page.locator('[data-drop-line]')).toHaveCount(1)
    await expect(page.locator('.ring-share-primary\\/70')).toHaveCount(1)
    await page.screenshot({ path: `${SHOTS}/touch-reorder-lifted.png` })
    await f.up()
    await page.waitForTimeout(250)

    await expect
      .poll(() => rootsOf(page, 'mustDo'))
      .toEqual([RICH_IDS.topDone, RICH_IDS.listTimed, RICH_IDS.topScheduled])
    const after = await readDay(page)
    expect(after.tasks.find((t) => t.id === RICH_IDS.listTimed)?.sectionId).toBe('mustDo')
    // Worked minutes are sacred: a move never touches a session.
    expect(after.sessions).toEqual(before.sessions)
    await expect(page.locator('[data-drop-line]')).toHaveCount(0)
  })

  test('drag a Top 3 row below a Tasks row', async ({ page }) => {
    await openToday(page)
    await row(page, RICH_IDS.listLong).scrollIntoViewIfNeeded()
    const from = await center(row(page, RICH_IDS.topLong).locator('button').first())
    // Lower half of the first Tasks row: land just after it.
    const to = await center(row(page, RICH_IDS.listLong), 0.8)
    await holdAndDrag(page, from, to)

    await expect.poll(() => rootsOf(page, 'highPriority')).toEqual([
      RICH_IDS.listLong,
      RICH_IDS.topLong,
      RICH_IDS.listParent,
      RICH_IDS.listDone,
      RICH_IDS.listTimed,
    ])
    expect(await rootsOf(page, 'mustDo')).toEqual([RICH_IDS.topDone, RICH_IDS.topScheduled])
  })

  test('reorder two Tasks rows', async ({ page }) => {
    await openToday(page)
    await row(page, RICH_IDS.listTimed).scrollIntoViewIfNeeded()
    const from = await center(row(page, RICH_IDS.listTimed).locator('button').first())
    // Upper half of the done row: land just before it.
    const to = await center(row(page, RICH_IDS.listDone), 0.2)
    await holdAndDrag(page, from, to)

    await expect.poll(() => rootsOf(page, 'highPriority')).toEqual([
      RICH_IDS.listLong,
      RICH_IDS.listParent,
      RICH_IDS.listTimed,
      RICH_IDS.listDone,
    ])
    // The parent kept its subtask.
    const { tasks } = await readDay(page)
    expect(tasks.find((t) => t.id === RICH_IDS.listSubtask)?.parentId).toBe(RICH_IDS.listParent)
  })

  test('an ordinary swipe on a row scrolls the page and moves nothing', async ({ page }) => {
    await openToday(page)
    const before = await readDay(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    const target = row(page, RICH_IDS.topLong)
    const start = await center(target.locator('button').first())
    const f = await finger(page)
    await f.down(start)
    // No hold: straight into a 160px swipe up.
    await f.moveTo({ x: start.x, y: start.y - 160 }, 10)
    await f.up()
    await page.waitForTimeout(400)

    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(40)
    const after = await readDay(page)
    expect(after.tasks.map((t) => [t.id, t.sectionId])).toEqual(before.tasks.map((t) => [t.id, t.sectionId]))
    await expect(page.getByTestId('task-action-sheet')).toHaveCount(0)
  })

  test('the sheet moves a task between the Top 3 and Tasks, subtasks included', async ({ page }) => {
    await openToday(page)

    // Every Tasks root offers "Move to Top 3"; no Top 3 row and no subtask does.
    for (const id of [RICH_IDS.listLong, RICH_IDS.listParent, RICH_IDS.listDone, RICH_IDS.listTimed]) {
      const sheet = await openActions(page, id)
      await expect(sheet.getByRole('menuitem', { name: 'Move to Top 3' })).toBeVisible()
      await expect(sheet.getByRole('menuitem', { name: 'Move to Tasks' })).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
    }
    for (const id of [RICH_IDS.topDone, RICH_IDS.topScheduled, RICH_IDS.topLong]) {
      const sheet = await openActions(page, id)
      await expect(sheet.getByRole('menuitem', { name: 'Move to Tasks' })).toBeVisible()
      await expect(sheet.getByRole('menuitem', { name: 'Move to Top 3' })).toHaveCount(0)
      await page.keyboard.press('Escape')
    }
    {
      const sheet = await openActions(page, RICH_IDS.listSubtask)
      await expect(sheet.getByRole('menuitem', { name: /Move to (Top 3|Tasks)/ })).toHaveCount(0)
      await page.keyboard.press('Escape')
    }

    // The Top 3 is full: "Move to Top 3" is refused out loud, nothing moves.
    let sheet = await openActions(page, RICH_IDS.listParent)
    const full = await readDay(page)
    await sheet.getByRole('menuitem', { name: 'Move to Top 3' }).click()
    await expect(page.getByText('Top 3 is full. Move one out first.')).toBeVisible()
    expect((await readDay(page)).tasks).toEqual(full.tasks)

    // Make room, then a parent goes to the end of the Top 3 with its subtask.
    sheet = await openActions(page, RICH_IDS.topLong)
    await sheet.getByRole('menuitem', { name: 'Move to Tasks' }).click()
    sheet = await openActions(page, RICH_IDS.listParent)
    await sheet.getByRole('menuitem', { name: 'Move to Top 3' }).click()
    await expect.poll(() => rootsOf(page, 'mustDo')).toEqual([
      RICH_IDS.topDone,
      RICH_IDS.topScheduled,
      RICH_IDS.listParent,
    ])
    let { tasks } = await readDay(page)
    expect(tasks.find((t) => t.id === RICH_IDS.listSubtask)).toMatchObject({
      sectionId: 'mustDo',
      parentId: RICH_IDS.listParent,
    })

    // And back: "Move to Tasks" appends it, subtask still under it.
    sheet = await openActions(page, RICH_IDS.listParent)
    await sheet.getByRole('menuitem', { name: 'Move to Tasks' }).click()
    await expect.poll(() => rootsOf(page, 'highPriority')).toEqual([
      RICH_IDS.listLong,
      RICH_IDS.listDone,
      RICH_IDS.listTimed,
      RICH_IDS.topLong,
      RICH_IDS.listParent,
    ])
    ;({ tasks } = await readDay(page))
    expect(tasks.find((t) => t.id === RICH_IDS.listSubtask)).toMatchObject({
      sectionId: 'highPriority',
      parentId: RICH_IDS.listParent,
    })

    // A parent with subtasks now gets Move up too.
    sheet = await openActions(page, RICH_IDS.listParent)
    await expect(sheet.getByRole('menuitem', { name: 'Move up' })).toBeEnabled()
  })

  test('a subtask dragged out of its parent is refused out loud', async ({ page }) => {
    await openToday(page)
    await row(page, RICH_IDS.listSubtask).scrollIntoViewIfNeeded()
    const from = await center(row(page, RICH_IDS.listSubtask).locator('button').first())
    // Onto another task's row (the first Tasks root, not its parent).
    const to = await center(row(page, RICH_IDS.listLong), 0.3)
    const before = await readDay(page)
    await holdAndDrag(page, from, to)
    await expect(page.getByText('Subtasks stay inside their task. Use Move to another parent.')).toBeVisible()
    expect((await readDay(page)).tasks).toEqual(before.tasks)
  })
})

// ── Desktop ──────────────────────────────────────────────────────────────────

function seedDesktop(page: Page, tasks: Array<Record<string, unknown>>) {
  return page.addInitScript((tasks) => {
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    window.sessionStorage.setItem('deepblock_guest_session', '1')
    window.localStorage.setItem('deepblock_tour_done', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_monthly', '1')
    window.sessionStorage.setItem('review_reminder_dismissed_weekly', '1')
    window.sessionStorage.setItem(`shutdown_reminder_shown_${iso}`, '1')
    window.localStorage.setItem(
      'deepblock_state_v1',
      JSON.stringify({
        version: 1,
        state: {
          days: {
            [iso]: {
              date: iso,
              tasks: (tasks as Array<Record<string, unknown>>).map((t) => ({ isDone: false, ...t, date: iso })),
              habitCompletions: {},
              deepWorkSessions: [],
            },
          },
        },
      }),
    )
  }, tasks)
}

async function openDesktop(page: Page) {
  await page.goto('/')
  await expect(page.locator('[data-tour="date-nav"]')).toBeVisible({ timeout: 40_000 })
  await expect(page.getByText('AAA', { exact: true })).toBeVisible()
}

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(to.x, to.y, { steps: 2 })
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await page.waitForTimeout(300)
}

const ABC = [
  { id: 'A', title: 'AAA', sectionId: 'highPriority' },
  { id: 'B', title: 'BBB', sectionId: 'highPriority' },
  { id: 'C', title: 'CCC', sectionId: 'highPriority' },
]

test.describe('desktop 1280x900', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false })

  test('a mouse drag that starts on the checkbox does not reorder', async ({ page }) => {
    await seedDesktop(page, ABC)
    await openDesktop(page)
    const checkbox = page.getByRole('checkbox').first()
    const from = await center(checkbox)
    const ccc = await page.getByText('CCC', { exact: true }).boundingBox()
    if (!ccc) throw new Error('CCC not visible')
    await mouseDrag(page, { x: Math.round(from.x - (await checkbox.boundingBox())!.width * 0.1), y: from.y }, {
      x: ccc.x + ccc.width / 2,
      y: ccc.y + ccc.height - 3,
    })
    expect(await rootsOf(page, 'highPriority')).toEqual(['A', 'B', 'C'])

    // The title still drags (the guard is the checkbox, not the row).
    const aaa = await center(page.getByText('AAA', { exact: true }))
    await mouseDrag(page, aaa, { x: ccc.x + ccc.width / 2, y: ccc.y + ccc.height - 3 })
    await expect.poll(() => rootsOf(page, 'highPriority')).toEqual(['B', 'C', 'A'])
  })

  test('a task dropped on an empty Top 3 lands in it', async ({ page }) => {
    await seedDesktop(page, ABC)
    await openDesktop(page)
    const zone = page.getByTestId('top3-empty-drop')
    await expect(zone).toBeVisible()
    const from = await center(page.getByText('BBB', { exact: true }))
    await mouseDrag(page, from, await center(zone))
    await expect.poll(() => rootsOf(page, 'mustDo')).toEqual(['B'])
    expect(await rootsOf(page, 'highPriority')).toEqual(['A', 'C'])
  })

  test('Alt+ArrowDown on a grip moves the row and says so', async ({ page }) => {
    await seedDesktop(page, ABC)
    await openDesktop(page)
    const grip = page.getByRole('button', { name: 'Drag to move AAA' })
    await grip.focus()
    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => rootsOf(page, 'highPriority')).toEqual(['B', 'A', 'C'])
    await expect(page.getByText('Moved down. 2 of 3.')).toBeAttached()
    // Focus stays on the moved row's grip, so the next press keeps going.
    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => rootsOf(page, 'highPriority')).toEqual(['B', 'C', 'A'])
  })

  test('Enter on a Tasks grip opens its menu, focus in it, and Escape gives it back', async ({ page }) => {
    await seedDesktop(page, ABC)
    await openDesktop(page)
    const grip = page.getByRole('button', { name: 'Drag to move AAA' })
    await grip.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await expect(menu.getByRole('menuitem', { name: 'Move to Top 3' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(grip).toBeFocused()
  })

  test('a Top 3 row goes back to Tasks from the keyboard alone', async ({ page }) => {
    await seedDesktop(page, [
      { id: 'P1', title: 'Pone', sectionId: 'mustDo' },
      { id: 'P2', title: 'Ptwo', sectionId: 'mustDo' },
      ...ABC,
    ])
    await openDesktop(page)
    const grip = page.getByRole('button', { name: 'Drag to move Ptwo' })
    await grip.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Move up' })).toBeFocused()
    // Move down is disabled on the last row, so Tab skips to Move to Tasks.
    await page.keyboard.press('Tab')
    await expect(menu.getByRole('menuitem', { name: 'Move to Tasks' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(() => rootsOf(page, 'mustDo')).toEqual(['P1'])
    expect(await rootsOf(page, 'highPriority')).toEqual(['A', 'B', 'C', 'P2'])
  })

  test('a subtask dropped on another task is refused out loud', async ({ page }) => {
    await seedDesktop(page, [
      { id: 'A', title: 'AAA', sectionId: 'highPriority' },
      { id: 'S', title: 'SUB', sectionId: 'highPriority', parentId: 'A' },
      { id: 'B', title: 'BBB', sectionId: 'highPriority' },
    ])
    await openDesktop(page)
    const before = await readDay(page)
    const from = await center(page.getByText('SUB', { exact: true }))
    const bbb = await page.getByText('BBB', { exact: true }).boundingBox()
    if (!bbb) throw new Error('BBB not visible')
    await mouseDrag(page, from, { x: bbb.x + bbb.width / 2, y: bbb.y + bbb.height - 3 })
    await expect(page.getByText('Subtasks stay inside their task. Use Move to another parent.')).toBeVisible()
    expect((await readDay(page)).tasks).toEqual(before.tasks)
  })
})
