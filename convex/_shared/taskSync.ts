/**
 * Planner task ↔ Google Task reconciliation. Pure, so it can be unit-tested
 * without a Convex runtime or a Google mock.
 *
 * Each link remembers the last state both sides agreed on (`syncedTitle`,
 * `syncedDone`). A side that differs from that snapshot is the side that
 * changed, which is the whole trick: no clocks to compare and no timestamp
 * from Google to trust. Per field:
 *
 *   planner == Google            → converged; record it if the snapshot is stale
 *   planner != snapshot          → push the planner's value (it wins a tie)
 *   Google  != snapshot          → pull Google's value into the planner
 *
 * A pull is not recorded as agreed: the planner has not applied it yet. Once
 * it has, the next sync sees both sides equal and records that. If the
 * planner never applies it (a lost response), the pull is simply offered
 * again — never a stale value pushed back over the Google tick.
 *
 * Nothing here deletes. A task deleted in Google leaves the planner task
 * alone (marked gone, never re-sent); a task deleted in the planner is
 * removed from Google by an explicit call once the delete can no longer be
 * undone, not by its absence from a sync.
 */

export interface LocalTask {
  id: string
  title: string
  isDone: boolean
  parentId?: string
}

export interface TaskLink {
  taskId: string
  googleTaskId: string
  syncedTitle: string
  syncedDone: boolean
  remoteGone?: boolean
}

export interface RemoteTask {
  id: string
  title?: string
  status?: string
  deleted?: boolean
}

export interface FieldPatch {
  title?: string
  done?: boolean
}

export interface SyncPlan {
  /** Planner tasks with no Google counterpart yet, parents before children. */
  insert: LocalTask[]
  /** Linked tasks whose planner side changed: what to send to Google. */
  push: Array<{ link: TaskLink; patch: FieldPatch }>
  /** Linked tasks whose Google side changed: what the planner should apply. */
  pull: Array<{ taskId: string; patch: FieldPatch }>
  /** New agreed snapshots to store, by link. */
  record: Array<{ link: TaskLink; syncedTitle: string; syncedDone: boolean }>
  /** Linked tasks Google no longer has. */
  gone: TaskLink[]
}

export function remoteIsDone(remote: RemoteTask): boolean {
  return remote.status === "completed"
}

/**
 * `remoteById` holds every linked Google task that was looked up: the task,
 * or `null` when Google answered that it no longer exists. A link whose id
 * is missing from the map was not looked up and is left alone this pass.
 */
export function planTaskSync(
  local: LocalTask[],
  links: TaskLink[],
  remoteById: ReadonlyMap<string, RemoteTask | null>,
): SyncPlan {
  const plan: SyncPlan = { insert: [], push: [], pull: [], record: [], gone: [] }
  const linkByTask = new Map(links.map((l) => [l.taskId, l]))

  // Parents first so a child's insert can name its parent's Google id.
  const ordered = [...local.filter((t) => !t.parentId), ...local.filter((t) => t.parentId)]

  for (const task of ordered) {
    const link = linkByTask.get(task.id)
    if (!link) {
      plan.insert.push(task)
      continue
    }
    if (link.remoteGone) continue
    if (!remoteById.has(link.googleTaskId)) continue
    const remote = remoteById.get(link.googleTaskId)
    if (!remote || remote.deleted) {
      plan.gone.push(link)
      continue
    }

    const push: FieldPatch = {}
    const pull: FieldPatch = {}
    let syncedTitle = link.syncedTitle
    let syncedDone = link.syncedDone

    const remoteTitle = remote.title ?? ""
    if (task.title === remoteTitle) syncedTitle = task.title
    else if (task.title !== link.syncedTitle) {
      push.title = task.title
      syncedTitle = task.title
    } else pull.title = remoteTitle

    const remoteDone = remoteIsDone(remote)
    if (task.isDone === remoteDone) syncedDone = task.isDone
    else if (task.isDone !== link.syncedDone) {
      push.done = task.isDone
      syncedDone = task.isDone
    } else pull.done = remoteDone

    if (Object.keys(push).length > 0) plan.push.push({ link, patch: push })
    if (Object.keys(pull).length > 0) plan.pull.push({ taskId: task.id, patch: pull })
    if (syncedTitle !== link.syncedTitle || syncedDone !== link.syncedDone) {
      plan.record.push({ link, syncedTitle, syncedDone })
    }
  }
  return plan
}

/** The request body for a Google Task carrying the planner's state. */
export function googleTaskBody(patch: FieldPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.done !== undefined) {
    // Google refuses `needsAction` while a completion instant is still set,
    // so un-ticking clears it in the same request.
    body.status = patch.done ? "completed" : "needsAction"
    if (!patch.done) body.completed = null
  }
  return body
}

/**
 * Google Tasks keeps only the date part of `due`, read as UTC. Midnight UTC on
 * the planner's day is what makes Google Calendar show the task on that day.
 */
export function googleDueForDate(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`
}
