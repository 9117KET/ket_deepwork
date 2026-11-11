/**
 * e2e/away-block-day.spec.ts
 *
 * A block belongs to the day it started on, also when it lands while the app
 * is closed. The live path already filed it by its start (`blockDayIso`); the
 * stored record carried whichever day was on screen when it was last written,
 * so start a block today, page back to yesterday, close the tab, come back
 * after it landed, claim it: the minutes went onto yesterday.
 *
 * Each test opens the app, pages to yesterday, closes the page and opens a new
 * one in the same browser context, which keeps localStorage as a closed and
 * reopened tab would.
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const STATE_KEY = 'deepblock_state_v1'
const BLOCK_KEY = 'deepblock_active_block_v1'

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayIso = () => isoOf(new Date())
const yesterdayIso = () => isoOf(new Date(Date.now() - 86_400_000))

interface StoredBlock {
  dayIso: string
  startedAt: string
  status: 'running' | 'paused'
  endsAt: number | null
  remainingMs: number
  totalMinutes: number
}

interface Session {
  durationMinutes: number
  taskId?: string
  startedAt: string
  finishedAt?: string
}

/**
 * Seed today with one task and a running block that started today and has
 * `secondsLeft` to go. Written once, from the test, so a reopened page does not
 * re-seed over what the app stored.
 */
async function seedContext(context: BrowserContext, secondsLeft: number) {
  const page = await context.newPage()
  await page.goto('/privacy')
  await page.evaluate(
    ([stateKey, blockKey, left]) => {
      const d = new Date()
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      localStorage.setItem('deepblock_tour_done', '1')
      localStorage.setItem(
        stateKey as string,
        JSON.stringify({
          version: 1,
          state: {
            days: {
              [iso]: {
                date: iso,
                tasks: [
                  { id: 't1', title: 'Study German', sectionId: 'highPriority', date: iso, isDone: false, durationMinutes: 90 },
                ],
                deepWorkSessions: [],
                habitCompletions: {},
              },
            },
            activeDays: [iso],
          },
        }),
      )
      const totalMinutes = 45
      const leftMs = (left as number) * 1000
      localStorage.setItem(
        blockKey as string,
        JSON.stringify({
          dayIso: iso,
          taskId: 't1',
          label: 'Study German',
          totalMinutes,
          startedAt: new Date(Date.now() - (totalMinutes * 60_000 - leftMs)).toISOString(),
          status: 'running',
          endsAt: Date.now() + leftMs,
          remainingMs: 0,
        }),
      )
    },
    [STATE_KEY, BLOCK_KEY, secondsLeft] as const,
  )
  await page.close()
}

async function openPlanner(context: BrowserContext): Promise<Page> {
  const page = await context.newPage()
  await page.goto('/')
  const guest = page.getByRole('button', { name: 'Continue as guest' })
  if (await guest.isVisible({ timeout: 2_000 }).catch(() => false)) await guest.click()
  await expect(page.getByRole('button', { name: 'Previous day', exact: true }).first()).toBeAttached()
  // A running block takes the desktop screen (FocusMode); Esc leaves it and
  // never touches the block.
  if (await page.getByTestId('focus-mode').isVisible({ timeout: 1_500 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('focus-mode')).toBeHidden()
  }
  return page
}

async function readBlock(page: Page): Promise<StoredBlock | null> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), BLOCK_KEY)
}

async function readSessions(page: Page): Promise<Record<string, Session[]>> {
  return page.evaluate((k) => {
    const state = JSON.parse(localStorage.getItem(k) ?? 'null')?.state
    const out: Record<string, Session[]> = {}
    for (const [iso, day] of Object.entries(state?.days ?? {})) {
      out[iso] = (day as { deepWorkSessions?: Session[] }).deepWorkSessions ?? []
    }
    return out
  }, STATE_KEY)
}

async function goToYesterday(page: Page) {
  await page.getByRole('button', { name: 'Previous day', exact: true }).first().click()
  // The heading follows the selected day; the stored record is rewritten by an
  // effect right after.
  await page.waitForTimeout(400)
}

/** Wait, with the tab closed, until the stored block has landed. */
async function waitForLanding(block: StoredBlock) {
  const ms = (block.endsAt ?? Date.now()) - Date.now()
  if (ms > 0) await new Promise((r) => setTimeout(r, ms + 1_000))
}

async function claimAndCheck(page: Page, block: StoredBlock) {
  const claim = page.getByRole('button', { name: 'Log it' })
  await expect(claim).toBeVisible()
  await claim.click()

  await expect
    .poll(async () => Object.values(await readSessions(page)).flat().length, {
      message: 'the claimed block was never recorded',
    })
    .toBe(1)

  const sessions = await readSessions(page)
  const today = sessions[todayIso()] ?? []
  expect(today, 'the block started today, so its minutes belong to today').toHaveLength(1)
  expect(sessions[yesterdayIso()] ?? [], 'the day on screen gains nothing').toHaveLength(0)
  expect(today[0].durationMinutes).toBe(45)
  expect(today[0].taskId).toBe('t1')
  // The true start and finish instants, not the moment it was claimed.
  expect(today[0].startedAt).toBe(block.startedAt)
  expect(today[0].finishedAt).toBe(new Date(block.endsAt as number).toISOString())
}

test.describe('a block that lands while the app is closed belongs to the day it started', () => {
  test('a running block, with the planner paged to yesterday before the tab closed', async ({ context }) => {
    await seedContext(context, 8)
    const page = await openPlanner(context)
    await goToYesterday(page)
    const block = await readBlock(page)
    expect(block?.status).toBe('running')
    // The stored record is the evidence: it names the day the block started.
    expect(block?.dayIso).toBe(todayIso())
    await page.close()

    await waitForLanding(block as StoredBlock)
    const back = await openPlanner(context)
    await claimAndCheck(back, block as StoredBlock)
  })

  test('a paused block, restored, then resumed on yesterday and left to land', async ({ context }) => {
    await seedContext(context, 30)
    let page = await openPlanner(context)
    await goToYesterday(page)
    await page.getByRole('button', { name: 'Pause', exact: true }).first().click()
    await expect.poll(async () => (await readBlock(page))?.status).toBe('paused')
    await page.close()

    // Restored paused, on today's screen; page back and resume there.
    page = await openPlanner(context)
    expect((await readBlock(page))?.status).toBe('paused')
    await goToYesterday(page)
    await page.getByRole('button', { name: 'Resume', exact: true }).first().click()
    await expect.poll(async () => (await readBlock(page))?.status).toBe('running')
    const block = (await readBlock(page)) as StoredBlock
    expect(block.dayIso).toBe(todayIso())
    await page.close()

    await waitForLanding(block)
    const back = await openPlanner(context)
    const claim = back.getByRole('button', { name: 'Log it' })
    await expect(claim).toBeVisible()
    await claim.click()
    await expect
      .poll(async () => Object.values(await readSessions(back)).flat().length)
      .toBe(1)
    const sessions = await readSessions(back)
    expect(sessions[todayIso()] ?? []).toHaveLength(1)
    expect(sessions[yesterdayIso()] ?? []).toHaveLength(0)
    expect(sessions[todayIso()][0].startedAt).toBe(block.startedAt)
    expect(sessions[todayIso()][0].durationMinutes).toBe(45)
    expect(sessions[todayIso()][0].taskId).toBe('t1')
  })

  test('a block still in flight on return, landing live on yesterday', async ({ context }) => {
    await seedContext(context, 10)
    let page = await openPlanner(context)
    await goToYesterday(page)
    const block = (await readBlock(page)) as StoredBlock
    await page.close()

    // Back before it lands: it resumes live. Page to yesterday and let it land.
    page = await openPlanner(context)
    expect((await readBlock(page))?.status).toBe('running')
    await goToYesterday(page)
    await expect
      .poll(async () => Object.values(await readSessions(page)).flat().length, {
        timeout: 20_000,
        message: 'the block never landed',
      })
      .toBe(1)
    const sessions = await readSessions(page)
    expect(sessions[todayIso()] ?? []).toHaveLength(1)
    expect(sessions[yesterdayIso()] ?? []).toHaveLength(0)
    expect(sessions[todayIso()][0].startedAt).toBe(block.startedAt)
    expect(sessions[todayIso()][0].taskId).toBe('t1')
    await expect(page.getByRole('button', { name: 'Log it' })).toHaveCount(0)
  })

  // The timer's task options are built from the day on screen, so paging away
  // mid-block used to drop the attribution: the block was recorded against no
  // task, live or claimed. The block now holds its task from the moment it
  // starts.
  test('a claimed block keeps the task it was worked against when the planner is paged away', async ({ context }) => {
    await seedContext(context, 8)
    const page = await openPlanner(context)
    await goToYesterday(page)
    const block = (await readBlock(page)) as StoredBlock & { taskId?: string }
    expect(block.taskId).toBe('t1')
    await page.close()

    await waitForLanding(block)
    const back = await openPlanner(context)
    await back.getByRole('button', { name: 'Log it' }).click()
    await expect.poll(async () => (await readSessions(back))[todayIso()]?.[0]?.taskId).toBe('t1')
  })

  test('a block landing live keeps its task while yesterday is on screen', async ({ context }) => {
    await seedContext(context, 6)
    const page = await openPlanner(context)
    await goToYesterday(page)
    await expect
      .poll(async () => Object.values(await readSessions(page)).flat().length, {
        timeout: 20_000,
        message: 'the block never landed',
      })
      .toBe(1)
    const sessions = await readSessions(page)
    expect(sessions[todayIso()] ?? []).toHaveLength(1)
    expect(sessions[todayIso()][0].taskId).toBe('t1')
    expect(sessions[todayIso()][0].durationMinutes).toBe(45)
  })

  test('the sidebar timer still names the task after paging away mid-block', async ({ context }) => {
    await seedContext(context, 120)
    const page = await openPlanner(context)
    const workingOn = page.locator('#deep-work-timer-task')
    await expect(workingOn.locator('option:checked')).toHaveText('Study German')

    // Yesterday has no tasks to offer, but the running block is still for this one.
    await goToYesterday(page)
    await expect(workingOn).toBeVisible()
    await expect(workingOn).toBeDisabled()
    await expect(workingOn).toHaveValue('t1')
    await expect(workingOn.locator('option:checked')).toHaveText('Study German')
  })
})
