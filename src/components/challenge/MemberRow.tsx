/**
 * components/challenge/MemberRow.tsx
 *
 * One member's today, as the other is allowed to see it: the two acts, the
 * Top 3 (or, with no Top 3 set, the first tasks on their list, labelled
 * so), counts for the rest, earned minutes, habits, and the evening's note
 * and confession. The same row renders you and every other member, so what
 * you see of yourself is exactly what they see, and each fact is said once.
 *
 * Colour: "done" is `share-done` with a ✓ shape, every time; a broken don't
 * is the warning colour; nothing here is cyan, which belongs to the one
 * action on the screen.
 */

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { ChallengeSummary } from '../../domain/challenge'
import { dayCompletionPercent, formatClock, formatDeepMinutes } from '../../domain/challenge'
import { activeCommitments, keptLine, resolveDontTexts, type Commitment } from '../../domain/challengeCommitments'
import { WarningLine } from '../ui/Notices'

export interface MemberDayView {
  summary?: ChallengeSummary
  planSetAt?: number | null
  checkinAt?: number | null
  note?: string | null
  dontsBroken?: string[]
  goalsKept?: string[]
}

interface MemberRowProps {
  name: string
  isMe: boolean
  day: MemberDayView | null
  /** This member's own goals (normalized), archived ones included, so an old mark still counts. */
  goals?: Commitment[]
  /** This member's own don'ts, archived ones included, so an old confession still reads. */
  donts: Commitment[]
  /** Under the name, e.g. the partner's local date when it is not yours. */
  caption?: string
  /** Quiet actions at the end of the row (Share, Nudge). */
  actions?: ReactNode
  /** The inactivity warning, when it names this member. */
  warning?: string | null
  /** Who sees your row, in a sentence: "your partner" (default) or "the others" in a group. */
  audience?: string
}

function Act({ label, at }: { label: string; at: number | null | undefined }) {
  return at ? (
    <span className="inline-flex items-center gap-1 font-semibold text-share-done">
      <span aria-hidden>✓</span>
      <span>
        {label} {formatClock(at)}
      </span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-share-onSurfaceVariant">
      <span aria-hidden>–</span>
      <span>
        {label}
        <span className="sr-only"> not yet</span>
      </span>
    </span>
  )
}

/** One list of a member's tasks as the partner sees them: a filled ✓ or an empty ring, then the title. */
function TaskLines({ tasks }: { tasks: { title: string; isDone: boolean }[] }) {
  return (
    <ul className="mt-1.5 space-y-1.5">
      {tasks.map((t, i) => (
        <li key={i} className={`flex items-start gap-2.5 text-sm leading-snug ${t.isDone ? 'text-share-onSurfaceVariant' : 'text-share-onSurface'}`}>
          {t.isDone ? (
            <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-share-done">
              <Check aria-hidden className="h-3 w-3 text-share-bg" strokeWidth={3.5} />
              <span className="sr-only">Done:</span>
            </span>
          ) : (
            <span className="mt-px h-[18px] w-[18px] shrink-0 rounded-full border-2 border-share-outlineStrong">
              <span className="sr-only">Not done:</span>
            </span>
          )}
          <span className={`min-w-0 break-words ${t.isDone ? 'line-through decoration-share-onSurfaceDim' : ''}`}>{t.title}</span>
        </li>
      ))}
    </ul>
  )
}

export function MemberRow({ name, isMe, day, goals = [], donts, caption, actions, warning, audience = 'your partner' }: MemberRowProps) {
  const s = day?.summary
  const broke = resolveDontTexts(day?.dontsBroken ?? [], donts)
  const hasActiveDonts = activeCommitments(donts).length > 0
  // Only once there is a day to speak of; a member with no row has said nothing yet.
  const kept = day ? keptLine(day.goalsKept ?? [], goals) : null
  const percent = dayCompletionPercent(s)
  // Rows written since 7 Nov 2026 carry every visible task; older rows only the
  // counts, which stay readable as "+1/2 more".
  const tasks = s?.tasks
  const rest: string[] = []
  if (s && !tasks && s.tasksTotal > 0) rest.push(`+${s.tasksDone}/${s.tasksTotal} more`)
  if (s && s.privateCount > 0) rest.push(`${s.privateCount} private`)
  const meta: string[] = []
  if (s && s.deepWorkMinutes > 0) meta.push(`${formatDeepMinutes(s.deepWorkMinutes)} deep`)
  if (s && s.habitsTotal > 0) meta.push(`habits ${s.habitsDone}/${s.habitsTotal}`)
  const sees = audience === 'your partner' ? 'your partner sees' : `${audience} see`
  const top3Label = s?.top3FromTasks ? (isMe ? `No Top 3 set, so ${sees} your first three tasks` : 'No Top 3 set; their first three tasks') : 'Top 3'

  return (
    <article aria-label={isMe ? `You today` : `${name} today`} className="min-w-0 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-body font-bold text-share-onBg">
          {isMe ? 'You' : name}
          {caption && <span className="ml-2 text-caption font-medium text-share-onSurfaceVariant">{caption}</span>}
        </h3>
        {meta.length > 0 && <p className="shrink-0 text-caption text-share-onSurfaceVariant">{meta.join(' · ')}</p>}
      </div>

      {warning && (
        <div role="status" className="mt-1.5">
          <WarningLine className="text-sm">{warning}</WarningLine>
        </div>
      )}

      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Act label="Plan" at={day?.planSetAt} />
        <Act label="Check-in" at={day?.checkinAt} />
      </p>

      {(percent !== null || kept) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-share-onSurfaceVariant">
          {percent !== null && (
            <span className="inline-flex items-center gap-2">
              <span
                role="meter"
                aria-label="Planned time done"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-share-hairline"
              >
                <span className="block h-full rounded-full bg-share-done" style={{ width: `${percent}%` }} />
              </span>
              <span className="tabular-nums">{percent}% of planned time</span>
            </span>
          )}
          {kept && <span>{kept}</span>}
        </p>
      )}

      {s && s.top3.length > 0 ? (
        <div className="mt-3">
          <p className="text-caption text-share-onSurfaceVariant">{top3Label}</p>
          <TaskLines tasks={s.top3} />
        </div>
      ) : (
        !day?.planSetAt && !tasks?.length && (
          <p className="mt-2 text-sm text-share-onSurfaceVariant">{isMe ? 'Nothing planned yet today.' : 'Nothing shared yet today.'}</p>
        )
      )}

      {tasks && tasks.length > 0 && (
        <div className="mt-3">
          <p className="text-caption text-share-onSurfaceVariant">Tasks</p>
          <TaskLines tasks={tasks} />
        </div>
      )}

      {(rest.length > 0 || day?.checkinAt || broke.length > 0) && (
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-caption">
          <span className="text-share-onSurfaceVariant">{rest.join(' · ')}</span>
          {/* A broken don't is said as soon as it is marked; "kept all" is a claim only a check-in makes. */}
          {broke.length > 0 ? (
            <span className="text-share-tertiary">Broke: {broke.join(', ')}</span>
          ) : day?.checkinAt && hasActiveDonts ? (
            <span className="text-share-onSurfaceVariant">Kept all don&rsquo;ts</span>
          ) : null}
        </div>
      )}
      {day?.checkinAt && day.note && <p className="mt-1.5 whitespace-pre-wrap text-sm text-share-onSurface">{day.note}</p>}

      {actions && <div className="-mx-3 mt-2 flex flex-wrap items-center gap-1">{actions}</div>}
    </article>
  )
}
