/**
 * components/planner/SessionAttributionPanel.tsx
 *
 * "That block wasn't for this."
 *
 * Picking the wrong task in "Working on" takes a second, and until now it was
 * permanent: ninety earned minutes sat on the wrong row for good, because the
 * only thing in the app that touched a session's task was deleting the task.
 * The remedy for a mislabelled record was to destroy the label.
 *
 * So this lists what is recorded against the task and lets each one be pointed
 * somewhere else - including at nothing, which is what the timer records when
 * it runs with no task selected. Done tasks are offered too: realising a block
 * belonged to something you already ticked off is the common case, not an
 * exotic one.
 *
 * What it cannot do is change the work. The minutes, the instants and whether
 * they were earned all stay exactly as recorded; only the answer to "what was
 * this for" moves. That is why it asks for no confirmation - nothing here can
 * lose anything - and why it sits folded away under the logging controls rather
 * than in front of them.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { DeepWorkSession } from '../../domain/types'
import { formatMinutes, isManualSession } from '../../domain/taskProgress'

export interface AttributionTarget {
  id: string
  title: string
  isDone?: boolean
}

interface SessionAttributionPanelProps {
  /** Everything recorded against the task the sheet is open on. */
  sessions: DeepWorkSession[]
  /** Where those minutes could go instead - the day's other trackable tasks. */
  targets: AttributionTarget[]
  onReattribute: (sessionId: string, toTaskId: string | undefined) => void
}

export function SessionAttributionPanel({
  sessions,
  targets,
  onReattribute,
}: SessionAttributionPanelProps) {
  const [open, setOpen] = useState(false)
  if (sessions.length === 0) return null

  return (
    <div className="rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm text-share-onSurfaceVariant hover:text-share-onSurface"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span>Worked against the wrong task?</span>
        <span className="ml-auto text-xs tabular-nums text-share-onSurfaceVariant/60">
          {sessions.length}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-share-outlineVariant/30 px-3 py-3">
          {sessions.map((session) => (
            <div key={session.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-xs text-share-onSurface">
                <span className="tabular-nums">{formatMinutes(session.durationMinutes)}</span>
                <span className="ml-1.5 text-share-onSurfaceVariant/70">
                  {describeSession(session)}
                </span>
              </span>
              <select
                aria-label={`Move ${formatMinutes(session.durationMinutes)} to another task`}
                value={session.taskId ?? ''}
                onChange={(event) => onReattribute(session.id, event.target.value || undefined)}
                className="min-h-[36px] min-w-0 max-w-[60%] flex-1 rounded-md border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-2 py-1 text-xs text-share-onBg focus:border-share-primary focus:outline-none"
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.isDone ? `${target.title} (done)` : target.title}
                  </option>
                ))}
                <option value="">No task</option>
              </select>
            </div>
          ))}
          <p className="text-[11px] text-share-onSurfaceVariant/60">
            Moving a block keeps its minutes exactly as they were recorded.
          </p>
        </div>
      )}
    </div>
  )
}

/** "earned, 09:00–09:45" / "by hand, logged 18:20" - enough to tell two apart. */
function describeSession(session: DeepWorkSession): string {
  const kind = isManualSession(session) ? 'by hand' : 'earned'
  if (session.finishedAt) {
    return `${kind}, ${clock(session.startedAt)}–${clock(session.finishedAt)}`
  }
  const stamp = session.loggedAt ?? session.startedAt
  return `${kind}, ${isManualSession(session) ? 'logged' : 'started'} ${clock(stamp)}`
}

function clock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
