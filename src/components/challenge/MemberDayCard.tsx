/**
 * components/challenge/MemberDayCard.tsx
 *
 * One member's day as the other is allowed to see it: the two stamps, the
 * Top 3 with ticks, counts for the rest, earned minutes, habits, and the
 * evening's note and confession. The same card renders the viewer's own
 * row, so what you see of yourself is exactly what your partner sees.
 *
 * Emerald appears only on the two "✓" stamps (the README's one exception for
 * a completed state); a broken don't is the warning colour, `share.tertiary`.
 */

import { CheckCircle2, Circle } from 'lucide-react'
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
}

function Stamp({ label, at }: { label: string; at: number | null | undefined }) {
  return at ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
      ✓ {label} {formatClock(at)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-share-hairline px-2 py-0.5 text-[11px] text-share-onSurfaceVariant">
      {label} —
    </span>
  )
}

export function MemberDayCard({ name, isMe, day, donts, caption }: MemberDayCardProps) {
  const s = day?.summary
  // The member's full list, archived included: a don't removed since still reads as itself.
  const broke = resolveDontTexts(day?.dontsBroken ?? [], donts)
  return (
    <div className="h-full rounded-2xl bg-share-surfaceContainerLow p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-share-onBg">
          {name}
          {isMe && <span className="ml-1 text-xs font-normal text-share-onSurfaceVariant">(you)</span>}
        </p>
        {caption && <p className="shrink-0 text-[11px] text-share-onSurfaceVariant">{caption}</p>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Stamp label="Plan" at={day?.planSetAt} />
        <Stamp label="Check-in" at={day?.checkinAt} />
      </div>
      {!s || (s.top3.length === 0 && s.tasksTotal === 0 && s.privateCount === 0) ? (
        <p className="mt-3 text-xs text-share-onSurfaceVariant">No plan locked in yet today.</p>
      ) : (
        <>
          {s.top3.length > 0 && (
            <ul className="mt-3 space-y-1">
              {s.top3.map((t, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${t.isDone ? 'text-share-onSurfaceVariant line-through decoration-share-onSurfaceDim' : 'text-share-onSurface'}`}>
                  {t.isDone ? (
                    <CheckCircle2 aria-label="done" className="mt-0.5 h-4 w-4 shrink-0 text-share-primary" />
                  ) : (
                    <Circle aria-label="not done" className="mt-0.5 h-4 w-4 shrink-0 text-share-onSurfaceDim" />
                  )}
                  <span className="min-w-0 break-words">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-xs text-share-onSurfaceVariant">
            {s.tasksTotal > 0 && (
              <span>
                +{s.tasksDone}/{s.tasksTotal} more
              </span>
            )}
            {s.privateCount > 0 && (
              <span>
                {s.tasksTotal > 0 ? ' · ' : ''}
                {s.privateCount} private
              </span>
            )}
          </p>
        </>
      )}
      {s && (s.deepWorkMinutes > 0 || s.habitsTotal > 0) && (
        <p className="mt-1.5 text-xs text-share-onSurfaceVariant">
          {s.deepWorkMinutes > 0 && <span className="font-medium text-share-primary">{formatDeepMinutes(s.deepWorkMinutes)} deep</span>}
          {s.deepWorkMinutes > 0 && s.habitsTotal > 0 && ' · '}
          {s.habitsTotal > 0 && (
            <span>
              habits {s.habitsDone}/{s.habitsTotal}
            </span>
          )}
        </p>
      )}
      {day?.checkinAt && (
        <div className="mt-2 border-t border-share-hairline pt-2 text-xs">
          {broke.length > 0 ? (
            <p className="text-share-tertiary">Broke: {broke.join(', ')}</p>
          ) : (
            <p className="text-share-onSurfaceVariant">Kept every don&rsquo;t.</p>
          )}
          {day.note && <p className="mt-1 whitespace-pre-wrap text-share-onSurface">{day.note}</p>}
        </div>
      )}
    </div>
  )
}
