/**
 * convex/tasks.ts — planner tasks as Google Tasks.
 *
 * A planner task is mirrored into a "Deepblock" Google Tasks list, due on its
 * day, which is how it shows up on Google Calendar with a checkbox. Ticking it
 * in either place ticks it in the other; so does renaming it.
 *
 * One action does both directions for one day: the client sends the day's
 * tasks, the server reads the same tasks from Google, and `planTaskSync`
 * (pure, in `_shared/taskSync.ts`) says what moves which way. Deletes are
 * never inferred from absence — `removeTask` is called explicitly once a
 * planner delete can no longer be undone, and a task deleted in Google is
 * left in the planner and simply stops being mirrored.
 */

import { action, type ActionCtx } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { GOOGLE_RECONNECT, GOOGLE_TASKS_BASE } from "./_shared/google"
import { connectedCalendar, tasksGranted } from "./calendar"
import {
  googleDueForDate,
  googleTaskBody,
  planTaskSync,
  remoteIsDone,
  type RemoteTask,
} from "./_shared/taskSync"

const TASK_LIST_NAME = "Deepblock"
/** Google's page cap. A planner day never comes near it. */
const PAGE_SIZE = 100
const MAX_PAGES = 5

function listUrl(listId: string, taskId?: string): string {
  const base = `${GOOGLE_TASKS_BASE}/lists/${encodeURIComponent(listId)}/tasks`
  return taskId ? `${base}/${encodeURIComponent(taskId)}` : base
}

/**
 * A 403 from the Tasks API means the grant does not cover it: the connection
 * predates the Tasks scope, or the box was unticked on the consent screen.
 * Only reconnecting fixes that, so it is reported the same way as an expired
 * token.
 */
function assertScope(resp: Response): void {
  if (resp.status === 403) {
    throw new ConvexError({
      code: GOOGLE_RECONNECT,
      message: "Google Tasks access is missing. Reconnect Google Calendar to sync tasks.",
    })
  }
}

async function connectedTasks(ctx: ActionCtx) {
  const base = await connectedCalendar(ctx)
  if (!tasksGranted(base.conn)) {
    throw new ConvexError({
      code: GOOGLE_RECONNECT,
      message: "Google Tasks access is missing. Reconnect Google Calendar to sync tasks.",
    })
  }
  const headers = { Authorization: `Bearer ${base.accessToken}`, "content-type": "application/json" }

  const createList = async (): Promise<string> => {
    const resp = await fetch(`${GOOGLE_TASKS_BASE}/users/@me/lists`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: TASK_LIST_NAME }),
    })
    assertScope(resp)
    if (!resp.ok) throw new Error(`Failed to create the task list (${resp.status})`)
    const created = (await resp.json()) as { id: string }
    await ctx.runMutation(internal.calendarInternal.setTaskList, { userId: base.userId, taskListId: created.id })
    return created.id
  }

  return { ...base, headers, createList }
}

const localTaskValidator = v.object({
  id: v.string(),
  title: v.string(),
  isDone: v.boolean(),
  parentId: v.optional(v.string()),
})

export interface PulledChange {
  taskId: string
  title?: string
  isDone?: boolean
}

// ─── Sync one day both ways ────────────────────────────────────────────────────

export const syncDayTasks = action({
  args: { taskDate: v.string(), tasks: v.array(localTaskValidator) },
  handler: async (ctx, args): Promise<{ pulls: PulledChange[]; inserted: number; pushed: number }> => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.taskDate)) throw new Error("taskDate must be YYYY-MM-DD")
    const { userId, conn, headers, createList } = await connectedTasks(ctx)
    const due = googleDueForDate(args.taskDate)

    // ── Read the day from Google ──
    let listId = conn.taskListId ?? (await createList())
    const remoteById = new Map<string, RemoteTask | null>()
    const readPage = async (pageToken?: string): Promise<{ items: RemoteTask[]; next?: string } | "gone"> => {
      const url = new URL(listUrl(listId))
      url.searchParams.set("showCompleted", "true")
      url.searchParams.set("showHidden", "true")
      url.searchParams.set("maxResults", String(PAGE_SIZE))
      url.searchParams.set("dueMin", due)
      url.searchParams.set("dueMax", due)
      if (pageToken) url.searchParams.set("pageToken", pageToken)
      const resp = await fetch(url.toString(), { headers })
      assertScope(resp)
      if (resp.status === 404) return "gone"
      if (!resp.ok) throw new Error(`Failed to read Google Tasks (${resp.status})`)
      const data = (await resp.json()) as { items?: RemoteTask[]; nextPageToken?: string }
      return { items: data.items ?? [], next: data.nextPageToken }
    }
    let first = await readPage()
    if (first === "gone") {
      // The user deleted the whole list: start a fresh one. The old links
      // point at tasks that no longer exist anywhere, so they go too, and the
      // planner's tasks are mirrored again below.
      listId = await createList()
      first = await readPage()
      if (first === "gone") throw new Error("Failed to read Google Tasks")
    }
    let page = first
    for (let i = 0; i < MAX_PAGES; i++) {
      for (const item of page.items) remoteById.set(item.id, item)
      if (!page.next) break
      const nextPage = await readPage(page.next)
      if (nextPage === "gone") break
      page = nextPage
    }

    // ── Links for the day ──
    const allLinks: Doc<"googleTaskLinks">[] = await ctx.runQuery(internal.calendarInternal.getTaskLinksForDate, {
      userId,
      taskDate: args.taskDate,
    })
    const links: Doc<"googleTaskLinks">[] = []
    for (const link of allLinks) {
      if (link.googleTaskListId === listId) links.push(link)
      else await ctx.runMutation(internal.calendarInternal.deleteTaskLink, { linkId: link._id })
    }

    // A linked task not on the day's page was moved to another day in Google
    // or deleted. Ask, rather than guess: only a 404 counts as gone.
    const localIds = new Set(args.tasks.map((t) => t.id))
    for (const link of links) {
      if (link.remoteGone || remoteById.has(link.googleTaskId) || !localIds.has(link.taskId)) continue
      const resp = await fetch(listUrl(listId, link.googleTaskId), { headers })
      assertScope(resp)
      if (resp.status === 404 || resp.status === 410) remoteById.set(link.googleTaskId, null)
      else if (resp.ok) remoteById.set(link.googleTaskId, (await resp.json()) as RemoteTask)
      else throw new Error(`Failed to read a Google Task (${resp.status})`)
    }

    const plan = planTaskSync(args.tasks, links, remoteById)
    const linkDoc = new Map(links.map((l) => [l.taskId, l]))

    // ── Apply ──
    for (const link of plan.gone) {
      await ctx.runMutation(internal.calendarInternal.markTaskLinkGone, { linkId: linkDoc.get(link.taskId)!._id })
    }

    let pushed = 0
    for (const { link, patch } of plan.push) {
      const resp = await fetch(listUrl(listId, link.googleTaskId), {
        method: "PATCH",
        headers,
        body: JSON.stringify(googleTaskBody(patch)),
      })
      assertScope(resp)
      if (resp.status === 404 || resp.status === 410) {
        await ctx.runMutation(internal.calendarInternal.markTaskLinkGone, { linkId: linkDoc.get(link.taskId)!._id })
        continue
      }
      if (!resp.ok) throw new Error(`Failed to update a Google Task (${resp.status})`)
      pushed++
    }
    for (const { link, syncedTitle, syncedDone } of plan.record) {
      await ctx.runMutation(internal.calendarInternal.recordTaskLinkSynced, {
        linkId: linkDoc.get(link.taskId)!._id,
        syncedTitle,
        syncedDone,
      })
    }

    // Inserts go parents first (planTaskSync orders them) so a subtask can
    // sit under its parent in Google too.
    let inserted = 0
    const googleIdByTask = new Map(links.filter((l) => !l.remoteGone).map((l) => [l.taskId, l.googleTaskId]))
    for (const task of plan.insert) {
      const url = new URL(listUrl(listId))
      const parentGoogleId = task.parentId ? googleIdByTask.get(task.parentId) : undefined
      if (parentGoogleId) url.searchParams.set("parent", parentGoogleId)
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ ...googleTaskBody({ title: task.title, done: task.isDone }), due }),
      })
      assertScope(resp)
      if (!resp.ok) throw new Error(`Failed to create a Google Task (${resp.status})`)
      const created = (await resp.json()) as RemoteTask
      const { duplicate }: { duplicate: boolean } = await ctx.runMutation(internal.calendarInternal.linkGoogleTask, {
        userId,
        taskId: task.id,
        taskDate: args.taskDate,
        googleTaskListId: listId,
        googleTaskId: created.id,
        syncedTitle: task.title,
        syncedDone: remoteIsDone(created),
      })
      if (duplicate) {
        // Another device mirrored this task first; keep theirs.
        await fetch(listUrl(listId, created.id), { method: "DELETE", headers })
        continue
      }
      googleIdByTask.set(task.id, created.id)
      inserted++
    }

    return {
      pulls: plan.pull.map(({ taskId, patch }) => ({
        taskId,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.done !== undefined ? { isDone: patch.done } : {}),
      })),
      inserted,
      pushed,
    }
  },
})

// ─── Remove a deleted planner task from Google ─────────────────────────────────

/** Take a planner task's mirror out of Google. Already gone there is fine. */
export const removeTask = action({
  args: { taskId: v.string(), taskDate: v.string() },
  handler: async (ctx, args): Promise<{ removed: boolean }> => {
    const { userId, headers } = await connectedTasks(ctx)
    const link: Doc<"googleTaskLinks"> | null = await ctx.runQuery(internal.calendarInternal.getTaskLink, {
      userId,
      taskDate: args.taskDate,
      taskId: args.taskId,
    })
    if (!link) return { removed: false }
    if (!link.remoteGone) {
      const resp = await fetch(listUrl(link.googleTaskListId, link.googleTaskId), { method: "DELETE", headers })
      assertScope(resp)
      if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
        throw new Error(`Failed to remove the Google Task (${resp.status})`)
      }
    }
    await ctx.runMutation(internal.calendarInternal.deleteTaskLink, { linkId: link._id })
    return { removed: true }
  },
})
