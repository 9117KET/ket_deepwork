/**
 * pages/ChallengeDetailPage.tsx
 *
 * /challenge/:id — one challenge's dashboard. The page subscribes (the
 * challenge, every member's today, the season so far) and builds today's
 * summary from the planner; `ChallengeDetail` draws it. An id that is not
 * one of yours, or a challenge you have left, reads as a sentence and a way
 * back, never an error.
 */

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChallengeChrome, ChallengeSkeleton } from '../components/challenge/ChallengeChrome'
import { ChallengeDetail } from '../components/challenge/ChallengeDetail'
import { textButtonClass } from '../components/ui/textButtonClass'
import { buildChallengeSummary } from '../domain/challenge'
import { addDays } from '../domain/dateUtils'
import { DEFAULT_HABIT_DEFINITIONS } from '../domain/types'
import { otherToDatesOf, useChallengeDetail, useChallengeHistory, useChallenges } from '../hooks/useChallenges'
import { useMinuteTick } from '../hooks/useMinuteTick'
import { usePersistentState } from '../storage/localStorageState'

export function ChallengeDetailPage() {
  return (
    <ChallengeChrome wide>
      <DetailBody />
    </ChallengeChrome>
  )
}

function DetailBody() {
  const { id } = useParams<{ id: string }>()
  const now = useMinuteTick()
  const detail = useChallengeDetail(id, now)
  const { active } = useChallenges()
  const [appState, , isHydrating] = usePersistentState()
  // Each member's history runs to their own yesterday; their card is their today.
  const history = useChallengeHistory(
    detail.info ? detail.info.challenge.id : null,
    addDays(detail.myDate, -1),
    addDays(detail.partnerDate, -1),
    otherToDatesOf(detail.others),
  )

  const habits = appState.habitDefinitions ?? DEFAULT_HABIT_DEFINITIONS
  const summary = useMemo(
    () => (isHydrating ? null : buildChallengeSummary(appState.days[detail.myDate], habits)),
    [isHydrating, appState.days, detail.myDate, habits],
  )

  if (detail.status === 'loading' || detail.status === 'signedOut') return <ChallengeSkeleton />
  if (detail.status === 'missing' || !detail.info || !detail.progress) {
    return (
      <div>
        <h1 className="font-shareHeadline text-title text-share-onBg">Not one of your challenges</h1>
        <p className="mt-2 text-body text-share-onSurfaceVariant">The link may be old, or you have left this challenge.</p>
        <Link to="/challenge" className={textButtonClass('default', '-ml-3 mt-2')}>
          See your challenges
        </Link>
      </div>
    )
  }

  return <ChallengeDetail detail={{ ...detail, info: detail.info, progress: detail.progress }} history={history} summary={summary} activeCount={active.length} />
}
