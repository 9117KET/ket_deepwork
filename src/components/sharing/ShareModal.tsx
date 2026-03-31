/**
 * components/sharing/ShareModal.tsx
 *
 * Owner-only modal for generating and managing share links.
 * Supports view-only and edit (tasks) links; copy-to-clipboard per link.
 */

import { useEffect, useRef, useState } from 'react'
import type { ShareToken } from '../../storage/supabaseSharing'
import {
  fetchShareTokens,
  createShareToken,
  deleteShareToken,
} from '../../storage/supabaseSharing'

interface ShareModalProps {
  userId: string
  isOpen: boolean
  onClose: () => void
}

function buildShareUrl(token: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('share', token)
  return url.toString()
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

export function ShareModal({ userId, isOpen, onClose }: ShareModalProps) {
  const [tokens, setTokens] = useState<ShareToken[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newPermission, setNewPermission] = useState<'view' | 'edit'>('view')
  const [newLabel, setNewLabel] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setCreateError(null)
    fetchShareTokens(userId)
      .then(setTokens)
      .finally(() => setLoading(false))
  }, [isOpen, userId])

  const handleCreate = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createShareToken(userId, newPermission, newLabel.trim() || undefined)
      if (created) {
        setTokens((prev) => [created, ...prev])
        setNewLabel('')
      } else {
        setCreateError(
          'Could not create link. Make sure the share_tokens table migration has been run in Supabase, then try again.',
        )
      }
    } catch (err) {
      setCreateError(String(err))
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    await deleteShareToken(id)
    setTokens((prev) => prev.filter((t) => t.id !== id))
  }

  const handleCopy = (token: string) => {
    const url = buildShareUrl(token)

    const markCopied = () => {
      setCopied(token)
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = setTimeout(() => setCopied(null), 2000)
    }

    // Fallback for when the Clipboard API rejects (e.g. document lost focus
    // due to the modal overlay, or the browser has not yet granted permission).
    const fallbackCopy = () => {
      const el = document.createElement('textarea')
      el.value = url
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      try {
        document.execCommand('copy')
        markCopied()
      } finally {
        document.body.removeChild(el)
      }
    }

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(url).then(markCopied).catch(fallbackCopy)
    } else {
      fallbackCopy()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share planner"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Share your planner</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Anyone with a link can view or edit tasks. Links have no expiry.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        {/* Create new link */}
        <div className="mb-5 rounded-md border border-slate-700 bg-slate-950 p-3">
          <p className="text-xs font-medium text-slate-300 mb-2">New link</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {(['view', 'edit'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setNewPermission(p)}
                className={`rounded border px-3 py-1 text-xs font-medium ${
                  newPermission === p
                    ? 'border-sky-600 bg-sky-600 text-slate-950'
                    : 'border-slate-600 text-slate-300 hover:border-sky-600 hover:text-sky-300'
                }`}
              >
                {p === 'view' ? 'View only' : 'Can edit tasks'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional, e.g. Team)"
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-600 focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && !creating) void handleCreate() }}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className="rounded border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-sky-500 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create link'}
            </button>
          </div>
          {createError && (
            <p className="mt-2 text-xs text-red-400">{createError}</p>
          )}
        </div>

        {/* Existing links */}
        <div>
          <p className="text-xs font-medium text-slate-300 mb-2">Active links</p>
          {loading ? (
            <p className="text-xs text-slate-500 py-3 text-center">Loading…</p>
          ) : tokens.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">No share links yet.</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {tokens.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          t.permission === 'edit'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {t.permission === 'edit' ? 'Edit tasks' : 'View only'}
                      </span>
                      {t.label && (
                        <span className="text-xs text-slate-300 truncate">{t.label}</span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        Created {formatDate(t.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-600 font-mono truncate">
                      {buildShareUrl(t.token)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(t.token)}
                    className="shrink-0 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300"
                  >
                    {copied === t.token ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                    aria-label="Delete link"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
