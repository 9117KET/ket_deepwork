/**
 * hooks/useTouchReorder.ts
 *
 * Moving a task with a finger. HTML5 drag and drop never fires on a phone, so
 * the phone rows get their own gesture, built on pointer events:
 *
 *  - press and hold a row (HOLD_MS) without moving: the row lifts and the page
 *    stops scrolling for the rest of the touch;
 *  - move the finger: an insertion line shows where the row will land, in
 *    either list (the Top 3 or Tasks);
 *  - lift the finger: the row is dropped there through the planner's own
 *    handlers, so a move by finger is the same move as one by mouse.
 *
 * A finger that moves more than SLOP_PX before the hold completes is a scroll,
 * and the hook lets go of it at once. A hold released without moving is a tap.
 *
 * The hook owns the gesture; the lists render the lifted state and the line.
 * Rows describe themselves with data attributes (see `rootRowData` and
 * `subtaskRowData`), and the hook hit-tests them by geometry, so it needs no
 * registry and no refs from the lists.
 *
 * Subtasks move only among their siblings, as on the mouse path. A subtask
 * released over anything else is refused out loud (`onRefuseSubtask`).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TaskSectionId } from '../domain/types'

/** How long a finger rests on a row before it lifts. */
export const HOLD_MS = 300
/** Movement before the hold completes that makes the touch a scroll. */
export const SLOP_PX = 8
/** Distance from the viewport edge where a lifted row scrolls the page. */
const EDGE_PX = 56
/** The fixed tab bar sits over the bottom of the page on a phone. */
const BOTTOM_CHROME_PX = 72
const SCROLL_STEP_PX = 10
/** How far from the nearest row a finger can be and still aim at it. */
const NEAREST_ROW_PX = 40

/** The lifted state of a row under a finger: raised, outlined, above its neighbours. */
export const LIFTED_ROW_CLASS =
  'relative z-[55] rounded-xl bg-share-surfaceContainerHigh shadow-2xl shadow-black/40 ring-2 ring-share-primary/70'

/** What is being moved. */
export interface TouchDragItem {
  taskId: string
  sectionId: TaskSectionId
  /** Set for a subtask: it can only move among this parent's children. */
  parentId?: string
}

/** Where the dragged row would land if the finger lifted now. */
export type TouchDropTarget =
  | { kind: 'root'; sectionId: TaskSectionId; index: number }
  | { kind: 'subtask'; parentId: string; index: number }
  /** A subtask over another list or another parent's row. */
  | { kind: 'refused' }

export interface TouchReorderState {
  item: TouchDragItem | null
  target: TouchDropTarget | null
}

export interface UseTouchReorderOptions {
  /** Move a root task to `index` in `toSectionId`'s ordered list (subtasks included). */
  onDropRoot: (item: TouchDragItem, toSectionId: TaskSectionId, index: number) => void
  /** Reorder a subtask among its siblings. */
  onDropSubtask: (parentId: string, subtaskId: string, index: number) => void
  /** A subtask was released over another list or another parent. */
  onRefuseSubtask: () => void
  /** Off on a fine pointer: the mouse keeps HTML5 drag. */
  enabled: boolean
}

/** The props a phone row spreads onto its outer element. */
export interface TouchRowBinding {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void
}

export interface TouchReorder {
  state: TouchReorderState
  bind: (item: TouchDragItem) => TouchRowBinding
}

/**
 * Data attributes for a root row. `before` is the row's own index in its
 * section's ordered list; `after` is the index just past its last subtask.
 */
export function rootRowData(sectionId: TaskSectionId, before: number, after: number) {
  return {
    'data-reorder-row': 'root',
    'data-reorder-section': sectionId,
    'data-reorder-before': before,
    'data-reorder-after': after,
  } as const
}

/**
 * Data attributes for a subtask row. A root drag over it lands after the
 * whole parent (`parentAfter`); a sibling drag uses `siblingIndex`.
 */
export function subtaskRowData(
  sectionId: TaskSectionId,
  parentId: string,
  siblingIndex: number,
  parentAfter: number,
) {
  return {
    'data-reorder-row': 'subtask',
    'data-reorder-section': sectionId,
    'data-reorder-parent': parentId,
    'data-reorder-sibling': siblingIndex,
    'data-reorder-after': parentAfter,
  } as const
}

/** Data attributes for an empty list a row can be dropped into. */
export function emptyListData(sectionId: TaskSectionId) {
  return { 'data-reorder-empty': sectionId } as const
}

/** Nothing in these starts a lift: they own the touch. */
const NO_LIFT_SELECTOR = 'input, select, textarea, [contenteditable="true"]'

interface Gesture {
  pointerId: number
  item: TouchDragItem
  el: HTMLElement
  startX: number
  startY: number
  lastY: number
  startScrollY: number
  lifted: boolean
  moved: boolean
  timer: number | null
}

/** The lifted row follows the finger, page scroll included. */
function paintLift(g: Gesture) {
  const dy = g.lastY - g.startY + (window.scrollY - g.startScrollY)
  g.el.style.transform = `translateY(${dy}px)`
}

const sameTarget = (a: TouchDropTarget | null, b: TouchDropTarget | null) =>
  JSON.stringify(a) === JSON.stringify(b)

export function useTouchReorder({
  onDropRoot,
  onDropSubtask,
  onRefuseSubtask,
  enabled,
}: UseTouchReorderOptions): TouchReorder {
  const [state, setState] = useState<TouchReorderState>({ item: null, target: null })
  const gestureRef = useRef<Gesture | null>(null)
  const targetRef = useRef<TouchDropTarget | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const detachRef = useRef<(() => void) | null>(null)

  // The latest callbacks, read at release time.
  const callbacksRef = useRef({ onDropRoot, onDropSubtask, onRefuseSubtask })
  useEffect(() => {
    callbacksRef.current = { onDropRoot, onDropSubtask, onRefuseSubtask }
  }, [onDropRoot, onDropSubtask, onRefuseSubtask])

  // Once a row is lifted the page must not scroll under the finger. Only a
  // cancelled touchmove stops a pan, and React's touch listeners are passive,
  // so this one is native. It does nothing unless a row is lifted.
  useEffect(() => {
    if (!enabled) return
    const blockScroll = (e: TouchEvent) => {
      if (gestureRef.current?.lifted && e.cancelable) e.preventDefault()
    }
    document.addEventListener('touchmove', blockScroll, { passive: false })
    return () => document.removeEventListener('touchmove', blockScroll)
  }, [enabled])

  const setTarget = useCallback((next: TouchDropTarget | null) => {
    if (sameTarget(targetRef.current, next)) return
    targetRef.current = next
    setState((s) => ({ ...s, target: next }))
  }, [])

  /** Hit-test the rows under the finger. */
  const computeTarget = useCallback((g: Gesture, x: number, y: number): TouchDropTarget | null => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-reorder-row]')).filter(
      (el) => el !== g.el && !g.el.contains(el) && !el.contains(g.el),
    )
    const empties = Array.from(document.querySelectorAll<HTMLElement>('[data-reorder-empty]'))
    const within = (r: DOMRect) => y >= r.top && y <= r.bottom && x >= r.left - 16 && x <= r.right + 16

    let hit: HTMLElement | null = null
    let hitRect: DOMRect | null = null
    let bestDist = Infinity
    for (const el of rows) {
      const r = el.getBoundingClientRect()
      if (r.height === 0) continue
      if (within(r)) {
        hit = el
        hitRect = r
        break
      }
      const dist = y < r.top ? r.top - y : y - r.bottom
      if (dist < bestDist && x >= r.left - 16 && x <= r.right + 16) {
        bestDist = dist
        hit = el
        hitRect = r
      }
    }
    if (hit && hitRect && !within(hitRect) && bestDist > NEAREST_ROW_PX) {
      hit = null
      hitRect = null
    }

    let empty: HTMLElement | null = null
    for (const el of empties) {
      if (within(el.getBoundingClientRect())) empty = el
    }

    const isSubtaskDrag = Boolean(g.item.parentId)
    if (empty && (!hit || !within(hitRect!))) {
      if (isSubtaskDrag) return { kind: 'refused' }
      return { kind: 'root', sectionId: empty.dataset.reorderEmpty as TaskSectionId, index: 0 }
    }
    if (!hit || !hitRect) return null

    const upper = y < hitRect.top + hitRect.height / 2
    const kind = hit.dataset.reorderRow
    const sectionId = hit.dataset.reorderSection as TaskSectionId

    if (isSubtaskDrag) {
      if (kind !== 'subtask' || hit.dataset.reorderParent !== g.item.parentId) return { kind: 'refused' }
      const sibling = Number(hit.dataset.reorderSibling)
      return { kind: 'subtask', parentId: g.item.parentId!, index: upper ? sibling : sibling + 1 }
    }

    if (kind === 'subtask') {
      // Over a subtask: land after the whole parent, never inside it.
      return { kind: 'root', sectionId, index: Number(hit.dataset.reorderAfter) }
    }
    const index = upper ? Number(hit.dataset.reorderBefore) : Number(hit.dataset.reorderAfter)
    return { kind: 'root', sectionId, index }
  }, [])

  /** Drop a target that would leave the row exactly where it is. */
  const withoutNoop = useCallback((g: Gesture, t: TouchDropTarget | null): TouchDropTarget | null => {
    if (!t) return null
    const el = g.el
    if (t.kind === 'root' && t.sectionId === g.item.sectionId && !g.item.parentId) {
      const before = Number(el.dataset.reorderBefore)
      const after = Number(el.dataset.reorderAfter)
      if (t.index === before || t.index === after) return null
    }
    if (t.kind === 'subtask') {
      const own = Number(el.dataset.reorderSibling)
      if (t.index === own || t.index === own + 1) return null
    }
    return t
  }, [])

  const end = useCallback(
    (commit: boolean) => {
      const g = gestureRef.current
      detachRef.current?.()
      detachRef.current = null
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
      scrollFrameRef.current = null
      if (!g) return
      if (g.timer !== null) window.clearTimeout(g.timer)
      gestureRef.current = null
      g.el.style.transform = ''
      const target = targetRef.current
      targetRef.current = null
      setState({ item: null, target: null })
      if (!g.lifted || !commit) return
      if (g.moved) {
        // The finger's release would also click whatever it lands on.
        const swallow = (e: MouseEvent) => {
          e.stopPropagation()
          e.preventDefault()
        }
        window.addEventListener('click', swallow, true)
        window.setTimeout(() => window.removeEventListener('click', swallow, true), 400)
      }
      if (!target) return
      const cb = callbacksRef.current
      if (target.kind === 'refused') cb.onRefuseSubtask()
      else if (target.kind === 'subtask') cb.onDropSubtask(target.parentId, g.item.taskId, target.index)
      else cb.onDropRoot(g.item, target.sectionId, target.index)
    },
    [],
  )

  useEffect(() => () => end(false), [end])

  /** While a row is lifted near the top or bottom edge, scroll the page under it. */
  const startAutoScroll = useCallback(() => {
    const tick = () => {
      const g = gestureRef.current
      if (!g?.lifted) return
      const bottomEdge = window.innerHeight - BOTTOM_CHROME_PX - EDGE_PX
      let step = 0
      // Only once the finger has carried the row somewhere: a row lifted
      // where it already sits near an edge must not set the page moving.
      if (!g.moved) step = 0
      else if (g.lastY < EDGE_PX) step = -SCROLL_STEP_PX
      else if (g.lastY > bottomEdge) step = SCROLL_STEP_PX
      if (step !== 0) {
        window.scrollBy(0, step)
        paintLift(g)
        setTarget(withoutNoop(g, computeTarget(g, g.startX, g.lastY)))
      }
      scrollFrameRef.current = requestAnimationFrame(tick)
    }
    scrollFrameRef.current = requestAnimationFrame(tick)
  }, [computeTarget, setTarget, withoutNoop])

  const bind = useCallback(
    (item: TouchDragItem): TouchRowBinding => ({
      onPointerDown: (e) => {
        if (!enabled || e.pointerType !== 'touch' || !e.isPrimary) return
        if (gestureRef.current) return
        if ((e.target as HTMLElement | null)?.closest(NO_LIFT_SELECTOR)) return
        const el = e.currentTarget
        const g: Gesture = {
          pointerId: e.pointerId,
          item,
          el,
          startX: e.clientX,
          startY: e.clientY,
          lastY: e.clientY,
          startScrollY: window.scrollY,
          lifted: false,
          moved: false,
          timer: null,
        }
        gestureRef.current = g

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== g.pointerId) return
          if (!g.lifted) {
            // Moving before the hold completes is a scroll: let it go.
            if (Math.hypot(ev.clientX - g.startX, ev.clientY - g.startY) > SLOP_PX) end(false)
            return
          }
          g.lastY = ev.clientY
          if (Math.abs(ev.clientY - g.startY) > SLOP_PX) g.moved = true
          paintLift(g)
          setTarget(withoutNoop(g, computeTarget(g, g.startX, ev.clientY)))
        }
        const onUp = (ev: PointerEvent) => {
          if (ev.pointerId === g.pointerId) end(true)
        }
        const onCancel = (ev: PointerEvent) => {
          if (ev.pointerId === g.pointerId) end(false)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onCancel)
        detachRef.current = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onCancel)
        }

        g.timer = window.setTimeout(() => {
          g.timer = null
          if (gestureRef.current !== g) return
          g.lifted = true
          setState({ item, target: null })
          startAutoScroll()
        }, HOLD_MS)
      },
      // A long press would otherwise open the browser's own menu.
      onContextMenu: (e) => {
        if (gestureRef.current) e.preventDefault()
      },
    }),
    [enabled, end, setTarget, computeTarget, withoutNoop, startAutoScroll],
  )

  return { state, bind }
}
