/**
 * components/challenge/MemberDayCard.tsx
 *
 * One member's day as the other is allowed to see it: the two stamps as a
 * pair, the Top 3 with ticks (or, when no Top 3 was set, the first tasks on
 * their list, labelled so), counts for the rest, earned minutes, habits, and
 * the evening's note and confession. The same card renders the viewer's own
 * row, so what you see of yourself is exactly what your partner sees.
 *
 * Emerald appears only on the two "✓" stamps (the README's one exception for
 * a completed state); a broken don't is the warning colour, `share.tertiary`.
 *
 * `MemberDayLine` is the same day folded to one line, for the phone, where
 * your own day already fills Today.
 */

import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import type { ChallengeSummary } from '../../domain/challenge'
import { formatClock, formatDeepMinutes } from '../../domain/challenge'
import { resolveDontTexts, type DontLike } from '../../domain/challengeCommitments'

export interface MemberDayView {
  date: string
  summary: ChallengeSummary
  planSetAt?: number | null
  checkinAt?: number | null
  note?: string | null
  dontsBroken: string[]
}

interface MemberDayCardProps {
  name: string
  isMe: boolean
  day: MemberDayView | null
  /** This member's own don'ts, archived ones included. */
  donts: DontLike[]
  /** Shown under the name, e.g. the member's local date when it differs. */
  caption?: string
  className?: string
}

function Stamp({ label, at }: { label: string; at: number | null | undefined }) {
  return at ? (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 text-[11px] font-semibold text-emerald-300">
      ✓ {label} {formatClock(at)}
    </span>
  ) : (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-share-hairline px-2.5 text-[11px] text-share-onSurfaceVariant">
      {label} —
    </span>
  )
}

export function MemberDayCard({ name, isMe, day, donts, caption, className = '' }: MemberDayCardProps) {
  const s = day?.summary
  // The member's full list, archived included: a don't removed since still reads as itself.
  const broke = resolveDontTexts(day?.dontsBroken ?? [], donts)
  const empty = !s || (s.top3.length === 0 && s.tasksTotal === 0 && s.privateCount === 0)
  const rest: string[] = []
  if (s && s.tasksTotal > 0) rest.push(`+${s.tasksDone}/${s.tasksTotal} more`)
  if (s && s.privateCount > 0) rest.push(`${s.privateCount} private`)
  return (
    <article className={`flex h-full flex-col gap-3.5 rounded-2xl bg-share-surfaceContainerLow p-4 sm:p-[18px] ${className}`} aria-label={`${name} today`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-extrabold text-share-onBg">
          {name}
          {isMe && <span className="ml-1 text-xs font-medium text-share-onSurfaceDim">(you)</span>}
          {caption && <span className="ml-1.5 text-[11px] font-medium text-share-onSurfaceDim">{caption}</span>}
        </p>
        {s && (s.deepWorkMinutes > 0 || s.habitsTotal > 0) && (
          <p className="shrink-0 text-xs text-share-onSurfaceVariant">
            {s.deepWorkMinutes > 0 && <span className="font-bold text-share-primary">{formatDeepMinutes(s.deepWorkMinutes)} deep</span>}
            {s.deepWorkMinutes > 0 && s.habitsTotal > 0 && ' · '}
            {s.habitsTotal > 0 && (
              <span>
                habits {s.habitsDone}/{s.habitsTotal}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Stamp label="Plan" at={day?.planSetAt} />
        <span aria-hidden className="h-0.5 w-4 rounded bg-share-outlineVariant" />
        <Stamp label="Check-in" at={day?.checkinAt} />
      </div>

      {empty ? (
        <p className="text-xs text-share-onSurfaceVariant">No plan locked in yet today.</p>
      ) : (
        s.top3.length > 0 && (
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.09em] text-share-onSurfaceDim">
              {s.top3FromTasks ? (isMe ? 'NO TOP 3 SET · YOUR PARTNER SEES YOUR FIRST TASKS' : 'FROM THEIR LIST · NO TOP 3 SET') : 'TOP 3'}
            </p>
            <ul className="mt-2 space-y-2">
              {s.top3.map((t, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2.5 text-sm leading-snug ${t.isDone ? 'text-share-onSurfaceVariant line-through decoration-share-onSurfaceDim' : 'text-share-onSurface'}`}
                >
                  {t.isDone ? (
                    <span aria-label="done" className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-share-primary">
                      <Check aria-hidden className="h-3 w-3 text-share-onPrimary" strokeWidth={3.5} />
                    </span>
                  ) : (
                    <span aria-label="not done" className="mt-px h-[18px] w-[18px] shrink-0 rounded-full border-2 border-share-outlineVariant" />
                  )}
                  <span className="min-w-0 break-words">{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {(rest.length > 0 || day?.checkinAt) && (
        <div className="mt-auto border-t border-share-hairline pt-3 text-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-share-onSurfaceVariant">{rest.join(' · ')}</span>
            {day?.checkinAt &&
              (broke.length > 0 ? (
                <span className="text-share-tertiary">Broke: {broke.join(', ')}</span>
              ) : (
                <span className="text-share-onSurfaceVariant">Kept every don&rsquo;t</span>
              ))}
          </div>
          {day?.checkinAt && day.note && <p className="mt-1.5 whitespace-pre-wrap text-share-onSurface">{day.note}</p>}
        </div>
      )}
    </article>
  )
}

/** Your own day in one line, linking to Today, which shows it in full. */
export function MemberDayLine({ day, className = '' }: { day: MemberDayView | null; className?: string }) {
  const s = day?.summary
  const parts: string[] = []
  if (day?.checkinAt) parts.push(`checked in ${formatClock(day.checkinAt)}`)
  else if (day?.planSetAt) parts.push(`plan locked ${formatClock(day.planSetAt)}`)
  else parts.push('no plan yet')
  if (s && s.top3.length > 0) parts.push(`${s.top3.filter((t) => t.isDone).length}/${s.top3.length} ${s.top3FromTasks ? 'first tasks' : 'Top 3'}`)
  if (s && s.deepWorkMinutes > 0) parts.push(`${formatDeepMinutes(s.deepWorkMinutes)} deep`)
  const done = Boolean(day?.planSetAt && day?.checkinAt)
  return (
    <Link
      to="/"
      className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl bg-share-surfaceContainerLow px-3.5 text-share-onBg hover:bg-share-surfaceContainer ${className}`}
    >
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${done ? 'bg-emerald-300' : day?.planSetAt ? 'bg-share-primary' : 'bg-share-outlineVariant'}`} />
      <span className="min-w-0 flex-1 truncate text-[13px]">
        <span className="font-extrabold">You</span>
        <span className="text-share-onSurfaceVariant"> · {parts.join(' · ')}</span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-share-onSurfaceDim" />
    </Link>
  )
}
