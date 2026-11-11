/**
 * e2e/add-task-cancel.spec.ts
 *
 * Cancelling the title prompt of "Add task above", "Add task below" or "Add
 * subtask" adds nothing. It used to add a task called "New task" (or "New
 * subtask"), because a cancelled `window.prompt` returns null and the handlers
 * read null as the prefilled title.
 */

import { test, expect, type Page } from '@playwright/test'

const STATE_KEY = 'deepblock_state_v1'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface StoredTask {
  id: string
  title: string
  parentId?: string
}

async function seed(page: Page) {
  await page.addInitScript((stateKey) => {
    // Seed once per test: a reload must not wipe what the app wrote.
    if (sessionStorage.getItem('add-task-cancel-seeded')) return
    sessionStorage.setItem('add-task-cancel-seeded', '1')
    const d = new Date()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    localStorage.setItem('deepblock_tour_done', '1')
    localStorage.setItem(
      stateKey,
      JSON.stringify({
        version: 1,
        state: {
          days: {
            [iso]: {
              date: iso,
              tasks: [
                { id: 'a', title: 'First task', sectionId: 'highPriority', date: iso, isDone: false },
                { id: 'b', title: 'Second task', sectionId: 'highPriority', date: iso, isDone: false },
              ],
              deepWorkSessions: [],
              habitCompletions: {},
            },
          },
          activeDays: [iso],
        },
      }),
    )
  }, STATE_KEY)
}

async function openPlanner(page: Page) {
  await page.goto('/')
  const guest = page.getByRole('button', { name: 'Continue as guest' })
  if (await guest.isVisible({ timeout: 2_000 }).catch(() => false)) await guest.click()
  await expect(page.getByLabel('Drag to move First task').first()).toBeVisible()
}

async function readTasks(page: Page): Promise<StoredTask[]> {
  return page.evaluate(
    ([key, iso]) => JSON.parse(localStorage.getItem(key) ?? 'null')?.state?.days?.[iso]?.tasks ?? [],
    [STATE_KEY, todayIso()] as const,
  )
}

/** Open the row's menu (right-click on the handle, desktop) and pick an item. */
async function pick(page: Page, rowTitle: string, item: string) {
  await page.getByLabel(`Drag to move ${rowTitle}`).first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

/** Answer the next prompt: null cancels, a string is typed and accepted. */
function answerPrompt(page: Page, answer: string | null) {
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('prompt')
    if (answer === null) await dialog.dismiss()
    else await dialog.accept(answer)
  })
}

const ITEMS = ['Add task above', 'Add task below', 'Add subtask'] as const

test.describe('cancelling an add-task prompt adds nothing', () => {
  for (const item of ITEMS) {
    test(`${item}: cancel adds no task and no Undo`, async ({ page }) => {
      await seed(page)
      await openPlanner(page)

      answerPrompt(page, null)
      await pick(page, 'First task', item)
      await page.waitForTimeout(500)

      const tasks = await readTasks(page)
      expect(tasks.map((t) => t.id)).toEqual(['a', 'b'])
      await expect(page.getByText(/^New (sub)?task$/)).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Undo/ })).toHaveCount(0)
    })

    test(`${item}: a whitespace title adds no task`, async ({ page }) => {
      await seed(page)
      await openPlanner(page)

      answerPrompt(page, '   ')
      await pick(page, 'First task', item)
      await page.waitForTimeout(500)

      expect((await readTasks(page)).map((t) => t.id)).toEqual(['a', 'b'])
    })
  }

  test('a typed title still adds the task where it did', async ({ page }) => {
    await seed(page)
    await openPlanner(page)

    answerPrompt(page, 'Above first')
    await pick(page, 'First task', 'Add task above')
    await expect.poll(async () => (await readTasks(page)).length).toBe(3)

    answerPrompt(page, '  Below first  ')
    await pick(page, 'First task', 'Add task below')
    await expect.poll(async () => (await readTasks(page)).length).toBe(4)

    answerPrompt(page, 'Sub of second')
    await pick(page, 'Second task', 'Add subtask')
    await expect.poll(async () => (await readTasks(page)).length).toBe(5)

    const tasks = await readTasks(page)
    expect(tasks.map((t) => t.title)).toEqual([
      'Above first',
      'First task',
      'Below first',
      'Second task',
      'Sub of second',
    ])
    expect(tasks[4].parentId).toBe('b')
  })
})
