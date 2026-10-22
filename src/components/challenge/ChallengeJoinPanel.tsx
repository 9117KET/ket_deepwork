/**
 * components/challenge/ChallengeJoinPanel.tsx
 *
 * Paste the link a friend sent (or just its token) to join their challenge.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractInviteToken } from '../../domain/challenge'

export function ChallengeJoinPanel() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const token = extractInviteToken(value)
    if (!token) {
      setError('That does not look like an invite link.')
      return
    }
    navigate(`/challenge/join?invite=${encodeURIComponent(token)}`)
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-share-surfaceContainerLow p-4">
      <h2 className="font-shareHeadline text-lg font-black text-share-onBg">Join a challenge</h2>
      <p className="mt-0.5 text-xs text-share-onSurfaceVariant">Paste the invite link your partner sent you.</p>
      <div className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          placeholder="https://…/challenge/join?invite=…"
          aria-label="Invite link"
          className="min-h-[44px] w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-3 py-2 text-base text-share-onSurface sm:text-sm placeholder:text-share-onSurfaceVariant/60 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary"
        />
        <button type="submit" className="touch-target-coarse shrink-0 rounded-lg bg-share-primary px-3 text-sm font-bold text-share-onPrimary hover:bg-share-primaryContainer">
          Join
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
