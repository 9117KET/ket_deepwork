/**
 * e2e/harness/challengeGroupHarness.tsx
 *
 * e2e only. The challenge dashboard (`ChallengeDetail`) drawn from a fixture
 * instead of a live backend, so `e2e/challenge-group.spec.ts` can check what
 * a signed-in group member sees without two (or eight) signed-in accounts.
 * The Vite dev server serves `challenge-group.html` beside it; the case is
 * picked by `?case=`. Nothing here is built into the app.
 *
 * Cases:
 * - `two`: two people, as before groups.
 * - `group`: five people (you and four others), a closed stretch, a warning
 *   on the third member, a reopen stamp, you the creator.
 * - `full`: eight people, no seats left.
 * - `ended-past`: ended, you the creator, the end date already passed.
 * - `ended-ahead`: ended early, you the creator, the end date still ahead.
 * - `ended-member`: ended, someone else the creator.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import { ChallengeDetail } from '../../src/components/challenge/ChallengeDetail'
import { challengeProgress, type ChallengeSummary } from '../../src/domain/challenge'
import { addDays, todayIso } from '../../src/domain/dateUtils'

type Case = 'two' | 'group' | 'full' | 'ended-past' | 'ended-ahead' | 'ended-member'

const params = new URLSearchParams(window.location.search)
const which = (params.get('case') ?? 'group') as Case

const today = todayIso()
const NAMES = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus']
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const at = (iso: string, hour: number) => Date.parse(`${iso}T${String(hour).padStart(2, '0')}:00:00`)

function memberView(name: string, i: number, isCreator: boolean) {
  return {
    displayName: name,
    timezone: tz,
    joinedAt: 1_000 + i,
    goals: [`${name} goal`],
    goalItems: [{ id: `goal-${i}`, text: `${name} goal` }],
    donts: [{ id: `dont-${i}`, text: `${name} dont` }],
    key: `key-${name.toLowerCase()}`,
    isCreator,
  }
}

const summary: ChallengeSummary = {
  top3: [{ title: 'Write the report', isDone: false }],
  tasksDone: 0,
  tasksTotal: 0,
  tasks: [],
  privateCount: 0,
  deepWorkMinutes: 0,
  habitsDone: 0,
  habitsTotal: 0,
  plannedMinutes: 60,
  doneMinutes: 30,
}

function dayView(date: string, plan: boolean, checkin: boolean) {
  return {
    date,
    summary,
    summaryUpdatedAt: at(date, 9),
    planSetAt: plan ? at(date, 9) : null,
    checkinAt: checkin ? at(date, 22) : null,
    note: null,
    dontsBroken: [],
    goalsKept: [],
  }
}

function build(c: Case) {
  const otherCount = c === 'two' ? 1 : c === 'full' ? 7 : c.startsWith('ended') ? 2 : 4
  const ended = c.startsWith('ended')
  const iAmCreator = c !== 'ended-member'
  const startDate = addDays(today, -20)
  const endDate = c === 'ended-past' ? addDays(today, -2) : addDays(today, 40)
  const others = NAMES.slice(0, otherCount).map((n, i) => memberView(n, i + 1, !iAmCreator && i === 0))
  const closedSpans = c === 'group' ? [{ from: addDays(today, -9), to: addDays(today, -7) }] : []
  const challenge = {
    id: 'harness-challenge',
    name: c === 'two' ? 'Pair season' : 'Group season',
    startDate,
    endDate,
    planDeadline: '10:00',
    checkinDeadline: '23:59',
    createdAt: 1,
    status: ended ? 'ended' : 'active',
    endedReason: ended ? 'allLeft' : null,
    endedAt: ended ? at(addDays(today, -3), 12) : null,
    warning:
      c === 'group'
        ? { forMe: false, missedSince: addDays(today, -3), issuedAt: at(today, 1), memberKey: others[2]!.key, displayName: others[2]!.displayName }
        : null,
    isCreator: iAmCreator,
    solo: false,
    memberCount: otherCount + 1,
    capacity: 8,
    reopenedDate: c === 'group' ? addDays(today, -6) : null,
    closedSpans,
  }
  const me = memberView('Kin', 0, iAmCreator)
  // History: every member did a full day on each of the last three days before the closed stretch.
  const pastDates = [addDays(today, -12), addDays(today, -11), addDays(today, -10), addDays(today, -1)]
  const history = {
    challenge,
    mine: pastDates.map((d) => dayView(d, true, true)),
    partner: others[0] ? pastDates.map((d) => dayView(d, true, true)) : [],
    others: others.map((o, i) => ({ key: o.key, rows: pastDates.map((d) => dayView(d, true, i % 2 === 0)) })),
  }
  const mine = { ...dayView(today, true, false), _id: 'mine', _creationTime: 1, challengeId: 'harness-challenge', userId: 'me' }
  const otherCards = others.map((o, i) => ({ member: o, date: today, day: i === 0 ? dayView(today, true, false) : null }))
  const detail = {
    status: ended ? 'ended' : 'active',
    info: { challenge, me, partner: others[0] ?? null, others, invite: null },
    progress: challengeProgress({ startDate, endDate }, today),
    myDate: today,
    partnerDate: today,
    mine,
    partnerCard: otherCards[0]?.day ?? null,
    others: otherCards,
  }
  return { detail, history }
}

const { detail, history } = build(which)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <div className="min-h-dvh bg-share-bg px-4 py-6 text-share-onSurface">
        {/* The fixture stands in for the server's shapes; the casts keep the harness out of the app's types. */}
        <ChallengeDetail
          detail={detail as unknown as Parameters<typeof ChallengeDetail>[0]['detail']}
          history={history as unknown as Parameters<typeof ChallengeDetail>[0]['history']}
          summary={summary}
          activeCount={1}
        />
      </div>
    </MemoryRouter>
  </StrictMode>,
)
