/**
 * components/challenge/ChallengeJoinPanel.tsx
 *
 * Paste the link a friend sent (or just its token) to join their challenge.
 * Opens inline under "Join with a link" on the challenges list.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractInviteToken } from '../../domain/challenge'
import { ErrorLine } from '../ui/Notices'

export function ChallengeJoinPanel({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const token = extractInviteToken(value)
    if (!token) {
      setError('That does not look like an invite link. Paste the whole link you were sent.')
      inputRef.current?.focus()
      return
    }
    navigate(`/challenge/join?invite=${encodeURIComponent(token)}`)
  }

  return (
    <form onSubmit={submit} className="mt-4" aria-labelledby="join-heading">
      <h2 id="join-heading" className="text-section text-share-onBg">
        Join with a link
      </h2>
      <label htmlFor="invite-link" className="mt-1 block text-sm text-share-onSurfaceVariant">
        Paste the invite link you were sent.
      </label>
      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          id="invite-link"
          name="invite-link"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          placeholder="https://…/challenge/join?invite=…"
          aria-invalid={error ? true : undefined}
          className="min-h-11 w-full rounded-lg border border-share-outlineStrong bg-share-surfaceContainer px-3 py-2 text-base text-share-onSurface placeholder:text-share-onSurfaceDim focus:border-share-onBg focus:outline-none focus:ring-1 focus:ring-share-onBg sm:text-sm"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-lg border border-share-outlineStrong px-4 text-sm font-semibold text-share-onSurface hover:bg-share-surfaceContainerHigh focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg"
        >
          Open invite
        </button>
      </div>
      {error && <ErrorLine className="mt-2" message={error} />}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="-ml-3 mt-1 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh hover:text-share-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share-onBg"
        >
          Cancel
        </button>
      )}
    </form>
  )
}
