import { describe, expect, test } from "vitest"
import { googleDueForDate, googleTaskBody, planTaskSync, type TaskLink } from "./taskSync"

const link = (over: Partial<TaskLink> = {}): TaskLink => ({
  taskId: "t1",
  googleTaskId: "g1",
  syncedTitle: "Write",
  syncedDone: false,
  ...over,
})
const local = (over: Partial<{ id: string; title: string; isDone: boolean; parentId?: string }> = {}) => ({
  id: "t1",
  title: "Write",
  isDone: false,
  ...over,
})
const remote = (over: Partial<{ title: string; status: string; deleted: boolean }> = {}) => ({
  id: "g1",
  title: "Write",
  status: "needsAction",
  ...over,
})

const EMPTY = { insert: [], push: [], pull: [], record: [], gone: [] }

describe("planTaskSync", () => {
  test("a task with no link is inserted, parents before children", () => {
    const plan = planTaskSync(
      [local({ id: "c", title: "child", parentId: "p" }), local({ id: "p", title: "parent" })],
      [],
      new Map(),
    )
    expect(plan.insert.map((t) => t.id)).toEqual(["p", "c"])
    expect(plan.push).toEqual([])
  })

  test("ticked in the planner → pushed to Google, snapshot recorded", () => {
    const plan = planTaskSync([local({ isDone: true })], [link()], new Map([["g1", remote()]]))
    expect(plan.push).toEqual([{ link: link(), patch: { done: true } }])
    expect(plan.pull).toEqual([])
    expect(plan.record).toEqual([{ link: link(), syncedTitle: "Write", syncedDone: true }])
  })

  test("ticked in Google → pulled into the planner, snapshot NOT recorded yet", () => {
    const plan = planTaskSync([local()], [link()], new Map([["g1", remote({ status: "completed" })]]))
    expect(plan.pull).toEqual([{ taskId: "t1", patch: { done: true } }])
    expect(plan.push).toEqual([])
    expect(plan.record).toEqual([])
  })

  test("once the planner has applied a pull, both sides agree and that is recorded", () => {
    const plan = planTaskSync(
      [local({ isDone: true })],
      [link()],
      new Map([["g1", remote({ status: "completed" })]]),
    )
    expect(plan.push).toEqual([])
    expect(plan.pull).toEqual([])
    expect(plan.record).toEqual([{ link: link(), syncedTitle: "Write", syncedDone: true }])
  })

  test("un-ticked in Google after both agreed it was done → pulled back", () => {
    const plan = planTaskSync(
      [local({ isDone: true })],
      [link({ syncedDone: true })],
      new Map([["g1", remote({ status: "needsAction" })]]),
    )
    expect(plan.pull).toEqual([{ taskId: "t1", patch: { done: false } }])
    expect(plan.push).toEqual([])
  })

  test("both sides changed the same field → the planner wins", () => {
    const plan = planTaskSync(
      [local({ title: "Write ch. 2" })],
      [link()],
      new Map([["g1", remote({ title: "Write chapter two" })]]),
    )
    expect(plan.push).toEqual([{ link: link(), patch: { title: "Write ch. 2" } }])
    expect(plan.pull).toEqual([])
  })

  test("different fields changed on each side → one push and one pull", () => {
    const plan = planTaskSync(
      [local({ title: "Renamed" })],
      [link()],
      new Map([["g1", remote({ status: "completed" })]]),
    )
    expect(plan.push).toEqual([{ link: link(), patch: { title: "Renamed" } }])
    expect(plan.pull).toEqual([{ taskId: "t1", patch: { done: true } }])
    // Only the pushed field is recorded; the pulled one waits for the planner.
    expect(plan.record).toEqual([{ link: link(), syncedTitle: "Renamed", syncedDone: false }])
  })

  test("nothing changed → nothing to do", () => {
    expect(planTaskSync([local()], [link()], new Map([["g1", remote()]]))).toEqual(EMPTY)
  })

  test("deleted in Google → marked gone, the planner task is left alone", () => {
    const plan = planTaskSync([local({ isDone: true })], [link()], new Map([["g1", null]]))
    expect(plan.gone).toEqual([link()])
    expect(plan.insert).toEqual([])
    expect(plan.push).toEqual([])
    const soft = planTaskSync([local()], [link()], new Map([["g1", remote({ deleted: true })]]))
    expect(soft.gone).toEqual([link()])
  })

  test("a link already marked gone is never re-sent", () => {
    expect(planTaskSync([local()], [link({ remoteGone: true })], new Map())).toEqual(EMPTY)
  })

  test("a link that was not looked up this pass is left alone", () => {
    expect(planTaskSync([local({ isDone: true })], [link()], new Map())).toEqual(EMPTY)
  })

  test("a link whose task has left the planner is ignored — deletes are explicit", () => {
    expect(planTaskSync([], [link()], new Map([["g1", remote()]]))).toEqual(EMPTY)
  })
})

describe("googleTaskBody", () => {
  test("un-ticking clears the completion instant Google would otherwise reject", () => {
    expect(googleTaskBody({ done: false })).toEqual({ status: "needsAction", completed: null })
    expect(googleTaskBody({ done: true })).toEqual({ status: "completed" })
    expect(googleTaskBody({ title: "x" })).toEqual({ title: "x" })
  })
})

test("googleDueForDate is midnight UTC on the planner day", () => {
  expect(googleDueForDate("2026-10-21")).toBe("2026-10-21T00:00:00.000Z")
})
