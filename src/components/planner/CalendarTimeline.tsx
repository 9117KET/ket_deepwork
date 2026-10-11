/**
 * components/planner/CalendarTimeline.tsx
 *
 * The day as the calendar has it, above the task list. Read-only: the calendar
 * owns time, so this only shows it — what is on now, what is next — and links
 * out to Google for anything more.
 *
 * On today, what has already ended folds into one line, so the card answers
 * "what is left of my day" without scrolling past the morning.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CalendarEvent } from '../../services/calendarSyncService'
import type { CalendarDayStatus } from '../../hooks/useCalendarDay'

interface CalendarTimelineProps {
  status: CalendarDayStatus
  events: CalendarEvent[]
  isToday: boolean
  /** Epoch ms; injectable so tests and the minute tick share one clock. */
  now: number
}

const DAY_MS = 24 * 3_600_000

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

function fmt(iso: string) {
  return timeFmt.format(new Date(iso))
}

export function CalendarTimeline({ status, events, isToday, now }: CalendarTimelineProps) {
  const [showEarlier, setShowEarlier] = useState(false)

  const { allDay, earlier, rest } = useMemo(() => {
    // A timed event lasting a day or more (a trip entered with times) reads as
    // a chip like an all-day one, not as a "Now" row that never ends.
    const isSpan = (e: CalendarEvent) =>
      !e.allDay && e.start && e.end && Date.parse(e.end) - Date.parse(e.start) >= DAY_MS
    const timed = events.filter((e) => !e.allDay && e.start && e.end && !isSpan(e))
    const ended = (e: CalendarEvent) => isToday && Date.parse(e.end!) <= now
    return {
      allDay: events.filter((e) => e.allDay || isSpan(e)),
      earlier: timed.filter(ended),
      rest: timed.filter((e) => !ended(e)),
    }
  }, [events, isToday, now])

  if (status === 'signedOut' || status === 'checking') return null

  if (status === 'disconnected') {
    return (
      <section
        aria-label="Calendar"
        className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-share-outlineVariant/40 px-4 py-3"
      >
        <p className="text-xs text-share-onSurfaceVariant">
          See your day here and schedule tasks into it with reminders.
        </p>
        <Link
          to="/calendar"
          className="touch-target-coarse shrink-0 rounded-lg bg-share-primary/15 px-3 py-1.5 text-xs font-bold text-share-primary hover:bg-share-primary/25"
        >
          Connect calendar
        </Link>
      </section>
    )
  }

  const visible = showEarlier ? [...earlier, ...rest] : rest
  const isLoadingEmpty = status === 'loading' && events.length === 0

  return (
    <section aria-label="Calendar" className="rounded-2xl border border-share-outlineVariant/25 bg-share-surfaceContainer px-4 py-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-share-onSurfaceVariant">Calendar</h2>
        {status === 'error' && <span className="text-[11px] text-amber-300">Offline — showing last known</span>}
      </div>

      {allDay.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allDay.map((e) => (
            <span key={e.id} className="rounded-md bg-share-surfaceContainerHigh px-2 py-0.5 text-[11px] text-share-onSurface">
              {e.title}
            </span>
          ))}
        </div>
      )}

      {isLoadingEmpty ? (
        <div className="mt-2 space-y-2" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-share-surfaceContainerHigh" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-share-surfaceContainerHigh" />
        </div>
      ) : (
        <>
          {earlier.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEarlier((v) => !v)}
              className="mt-1.5 text-[11px] text-share-onSurfaceVariant/70 hover:text-share-onSurface"
            >
              {showEarlier ? 'Hide earlier' : `${earlier.length} earlier`}
            </button>
          )}
          {visible.length === 0 ? (
            <p className="mt-1.5 text-sm text-share-onSurfaceVariant">
              {isToday && earlier.length > 0 ? 'Nothing else on the calendar today.' : 'Nothing on the calendar.'}
            </p>
          ) : (
            <ol className="mt-1.5 space-y-1">
              {visible.map((e) => {
                const start = Date.parse(e.start!)
                const end = Date.parse(e.end!)
                const isNow = isToday && start <= now && now < end
                const isPast = isToday && end <= now
                return (
                  <li key={e.id}>
                    <a
                      href={e.htmlLink ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex min-h-[36px] items-center gap-3 rounded-lg px-2 py-1 -mx-2 ${
                        isNow ? 'bg-share-primary/10' : 'hover:bg-share-surfaceContainerHigh'
                      } ${isPast ? 'opacity-50' : ''}`}
                    >
                      <span className={`w-[5.5rem] shrink-0 text-xs tabular-nums ${isNow ? 'font-bold text-share-primary' : 'text-share-onSurfaceVariant'}`}>
                        {isNow ? 'Now' : fmt(e.start!)}
                        <span className="text-share-onSurfaceVariant/60">–{fmt(e.end!)}</span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-share-onSurface">{e.title}</span>
                      {e.taskId && (
                        <span className="shrink-0 rounded bg-share-primary/10 px-1.5 text-[10px] font-semibold text-share-primary">
                          task
                        </span>
                      )}
                    </a>
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
