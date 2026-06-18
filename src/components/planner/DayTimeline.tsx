/**
 * DayTimeline
 *
 * Pure presentational, read-only vertical agenda for the selected day.
 * Renders one block per scheduled task (has both `scheduledAt` + `durationMinutes`,
 * skipping subtasks) positioned by time and sized by duration. Deep vs shallow
 * tasks are coloured differently, overlapping tasks are split into side-by-side
 * lanes, and a "now" indicator is drawn when viewing today.
 *
 * No state or storage is touched — everything is derived from props.
 */

import { useMemo } from "react"
import type { Task } from "../../domain/types"

interface Props {
  /** Root + subtask list for the selected day (subtasks are filtered out here). */
  tasks: Task[]
  /** Wake time "HH:MM"; falls back to 06:00 when missing/invalid. */
  wakeTime?: string | null
  /** Sleep target "HH:MM"; falls back to 24:00 when missing/invalid. */
  sleepTarget?: string | null
  /** True when the selected day is today (controls the "now" line). */
  isToday: boolean
  /** Current minutes since midnight (already offset-adjusted by the caller). */
  nowMinutes: number
  /**
   * Capacity-aware block windows (Morning / High / Medium / Low / Night) drawn as
   * labelled background bands so the day's structure is visible even for tasks
   * without an explicit time. `over` tints the band amber (work exceeds its window).
   * Times are minutes since midnight; bands ending past midnight are handled.
   */
  blocks?: { sectionId: string; startMin: number; endMin: number; label: string; over?: boolean }[]
}

const PX_PER_MIN = 0.9 // 54px per hour — compact but legible in the sidebar

interface PositionedTask {
  task: Task
  startMin: number
  endMin: number
  /** Lane index for overlap resolution (0-based). */
  lane: number
  /** Total lanes in this task's overlap cluster. */
  laneCount: number
}

/** Parse "HH:MM" to minutes since midnight, or null when malformed. */
function parseHHMM(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const parts = hhmm.split(":")
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function formatHour(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12} ${period}`
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

function formatDur(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * Assign lanes so overlapping blocks sit side-by-side. Tasks are sorted by start
 * time; each task takes the first lane whose previous task has already ended.
 * Clusters of mutually-overlapping tasks share a `laneCount`.
 */
function assignLanes(items: { task: Task; startMin: number; endMin: number }[]): PositionedTask[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const result: PositionedTask[] = []
  let cluster: PositionedTask[] = []
  let clusterEnd = -Infinity
  const laneEnds: number[] = []

  const flush = () => {
    const laneCount = cluster.length === 0 ? 1 : Math.max(...cluster.map((c) => c.lane)) + 1
    for (const c of cluster) c.laneCount = laneCount
    cluster = []
    laneEnds.length = 0
  }

  for (const item of sorted) {
    // A gap with no active block ends the current overlap cluster.
    if (item.startMin >= clusterEnd) flush()

    let lane = laneEnds.findIndex((end) => end <= item.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.endMin)
    } else {
      laneEnds[lane] = item.endMin
    }

    const positioned: PositionedTask = { ...item, lane, laneCount: 1 }
    cluster.push(positioned)
    result.push(positioned)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  flush()
  return result
}

export function DayTimeline({ tasks, wakeTime, sleepTarget, isToday, nowMinutes, blocks }: Props) {
  const { positioned, startMin, endMin, hourMarks, bands, sleep } = useMemo(() => {
    const scheduled = tasks
      .filter((t) => !t.parentId && t.scheduledAt != null && t.durationMinutes != null)
      .map((t) => {
        const s = parseHHMM(t.scheduledAt)
        if (s == null) return null
        const dur = Math.max(1, t.durationMinutes ?? 0)
        return { task: t, startMin: s, endMin: s + dur }
      })
      .filter((x): x is { task: Task; startMin: number; endMin: number } => x !== null)

    const wakeMin = parseHHMM(wakeTime) ?? 6 * 60
    const rawSleep = parseHHMM(sleepTarget)
    // sleepTarget of midnight or earlier-than-wake wraps to end of day.
    let sleepMin = rawSleep == null ? 24 * 60 : rawSleep
    if (sleepMin <= wakeMin) sleepMin += 24 * 60

    // Normalise a wrapped clock minute onto the wake-anchored axis (post-midnight → +1440).
    const norm = (m: number) => (m < wakeMin ? m + 1440 : m)
    const normBands = (blocks ?? []).map((b) => {
      const bs = norm(b.startMin)
      let be = norm(b.endMin)
      if (be <= bs) be += 1440
      return { sectionId: b.sectionId, label: b.label, over: b.over ?? false, startMin: bs, endMin: be }
    })

    // Expand the window so any task or band outside wake/sleep still fits.
    let lo = wakeMin
    let hi = sleepMin
    for (const s of scheduled) {
      if (s.startMin < lo) lo = s.startMin
      if (s.endMin > hi) hi = s.endMin
    }
    for (const b of normBands) {
      if (b.startMin < lo) lo = b.startMin
      if (b.endMin > hi) hi = b.endMin
    }
    // Snap to whole hours for clean gridlines.
    const start = Math.floor(lo / 60) * 60
    const end = Math.ceil(hi / 60) * 60

    const marks: number[] = []
    for (let m = start; m <= end; m += 60) marks.push(m)

    return {
      positioned: assignLanes(scheduled),
      startMin: start,
      endMin: end,
      hourMarks: marks,
      bands: normBands,
      sleep: { startMin: sleepMin, endMin: wakeMin + 1440, durMin: wakeMin + 1440 - sleepMin },
    }
  }, [tasks, wakeTime, sleepTarget, blocks])

  const totalMin = Math.max(60, endMin - startMin)
  const height = totalMin * PX_PER_MIN
  const nowInRange = isToday && nowMinutes >= startMin && nowMinutes <= endMin
  const nowTop = (nowMinutes - startMin) * PX_PER_MIN

  return (
    <div className="rounded-lg border border-share-outlineVariant/25 bg-share-surfaceContainerLow p-3 text-xs">
      {positioned.length === 0 && bands.length === 0 ? (
        <p className="text-share-onSurfaceVariant/70 py-2">
          No scheduled tasks yet. Set a time and duration on a task to see it here.
        </p>
      ) : (
        <div className="relative pl-12" style={{ height }}>
          {/* Block windows (background bands) — the day's planned structure */}
          {bands.map((b) => {
            const top = (b.startMin - startMin) * PX_PER_MIN
            const h = Math.max(0, (b.endMin - b.startMin) * PX_PER_MIN)
            return (
              <div
                key={b.sectionId}
                className={`absolute left-0 right-0 rounded border ${
                  b.over
                    ? "border-amber-500/30 bg-amber-500/[0.06]"
                    : "border-share-outlineVariant/10 bg-share-surfaceContainerHighest/40"
                }`}
                style={{ top, height: h }}
                title={`${b.label}: ${formatClock(b.startMin)} – ${formatClock(b.endMin)}${b.over ? " (over capacity)" : ""}`}
              >
                <span
                  className={`absolute right-1 top-0.5 text-[8px] uppercase tracking-wide ${
                    b.over ? "text-amber-400/80" : "text-share-onSurfaceVariant/40"
                  }`}
                >
                  {b.label}
                </span>
              </div>
            )
          })}

          {/* Hour gridlines + labels */}
          {hourMarks.map((m) => {
            const top = (m - startMin) * PX_PER_MIN
            return (
              <div key={m} className="absolute left-0 right-0 flex items-center" style={{ top }}>
                <span className="absolute -left-0 w-10 -translate-y-1/2 text-right pr-1 text-[9px] tabular-nums text-share-onSurfaceVariant/50">
                  {formatHour(m)}
                </span>
                <div className="ml-12 flex-1 border-t border-share-outlineVariant/15" />
              </div>
            )
          })}

          {/* Task blocks */}
          {positioned.map(({ task, startMin: ts, endMin: te, lane, laneCount }) => {
            const top = (ts - startMin) * PX_PER_MIN
            const blockHeight = Math.max(14, (te - ts) * PX_PER_MIN - 2)
            const widthPct = 100 / laneCount
            const leftPct = lane * widthPct
            const overlapping = laneCount > 1
            const colour = task.isShallow
              ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
              : "border-share-primary/40 bg-share-primary/15 text-share-onBg"
            return (
              <div
                key={task.id}
                className={`absolute rounded-md border px-1.5 py-0.5 overflow-hidden ${colour} ${task.isDone ? "opacity-50" : ""}`}
                style={{
                  top,
                  height: blockHeight,
                  left: `calc(${leftPct}% + ${lane === 0 ? 0 : 2}px)`,
                  width: `calc(${widthPct}% - ${overlapping ? 3 : 0}px)`,
                }}
                title={`${formatClock(ts)} – ${formatClock(te)} · ${task.title}${overlapping ? " (overlapping)" : ""}`}
              >
                <div className="flex items-start gap-1">
                  {overlapping && <span className="shrink-0 text-[9px] leading-tight" aria-hidden="true">⚠</span>}
                  <span className={`truncate font-medium leading-tight ${task.isDone ? "line-through" : ""}`}>
                    {task.title}
                  </span>
                </div>
                {blockHeight > 26 && (
                  <span className="block text-[9px] opacity-70 tabular-nums leading-tight">
                    {formatClock(ts)}
                  </span>
                )}
              </div>
            )
          })}

          {/* Now indicator */}
          {nowInRange && (
            <div className="absolute left-12 right-0 z-10 flex items-center" style={{ top: nowTop }}>
              <span className="absolute -left-12 w-10 -translate-y-1/2 text-right pr-1 text-[9px] font-semibold tabular-nums text-rose-400">
                now
              </span>
              <div className="h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-rose-500" />
              <div className="flex-1 border-t border-rose-500/70" />
            </div>
          )}
        </div>
      )}

      {/* Sleep window — compact, not to scale, so the day stays legible */}
      <div className="mt-2 flex items-center gap-1.5 rounded border border-indigo-500/20 bg-indigo-500/[0.07] px-2 py-1 text-[10px] text-indigo-300/80">
        <span aria-hidden="true">🌙</span>
        <span className="tabular-nums">
          Sleep {formatClock(sleep.startMin)} – {formatClock(sleep.endMin)}
        </span>
        <span className="ml-auto tabular-nums opacity-70">{formatDur(sleep.durMin)}</span>
      </div>
    </div>
  )
}
