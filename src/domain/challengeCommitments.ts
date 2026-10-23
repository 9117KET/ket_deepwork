/**
 * domain/challengeCommitments.ts
 *
 * A member's own goals and don'ts, as the client handles them. Pure.
 *
 * A removed don't is archived on the server, never deleted, so the full
 * list (archived included) is what resolves a check-in's `dontsBroken` ids.
 * Only the active ones are offered for a new check-in or shown as current.
 */

export interface DontLike {
  id: string
  text: string
  archivedAt?: number
}

/** One row in an editor: an existing don't keeps its id, a new one has none. */
export interface CommitmentRow {
  id?: string
  text: string
}

const UNKNOWN_DONT = 'a don’t'

export function activeDonts<T extends DontLike>(list: readonly T[]): T[] {
  return list.filter((d) => d.archivedAt === undefined)
}

/** Texts for the ids, in order. An id nobody knows reads as "a don't" rather than vanishing. */
export function resolveDontTexts(ids: readonly string[], list: readonly DontLike[]): string[] {
  return ids.map((id) => list.find((d) => d.id === id)?.text ?? UNKNOWN_DONT)
}

/** Editor rows for the active don'ts, ids kept so an edit in place stays the same don't. */
export function dontsToRows(list: readonly DontLike[]): CommitmentRow[] {
  return activeDonts(list).map((d) => ({ id: d.id, text: d.text }))
}

export function textsToRows(texts: readonly string[]): CommitmentRow[] {
  return texts.map((text) => ({ text }))
}

/**
 * The editor's "Add" step: the list with the draft appended, or null when the
 * draft is blank or the list is full. Called on Enter, on Add and on blur, so
 * text left in the box is never dropped; a second call after the draft was
 * cleared is a no-op, which is what stops a blur-then-click double add.
 */
export function commitDraft(items: readonly CommitmentRow[], draft: string, max: number): CommitmentRow[] | null {
  const text = draft.trim()
  if (!text || items.length >= max) return null
  return [...items, { text }]
}

/** The server's cap on each list (`MAX_LIST` in convex/challenges.ts). */
export const MAX_COMMITMENTS = 10

/** The list a Save / Create / Join sends: with any text still in the Add box, never without it. */
export function withDraft(items: readonly CommitmentRow[], draft: string): CommitmentRow[] {
  return commitDraft(items, draft, MAX_COMMITMENTS) ?? [...items]
}

/** Trimmed texts, blanks dropped. */
export function rowsToTexts(rows: readonly CommitmentRow[]): string[] {
  return rows.map((r) => r.text.trim()).filter((t) => t.length > 0)
}

/**
 * What `updateMyCommitments` takes for don'ts. A blank row is left out, so the
 * server archives it if it had an id; a row without an id is minted fresh.
 */
export function rowsToDontPayload(rows: readonly CommitmentRow[]): CommitmentRow[] {
  return rows
    .map((r) => ({ ...(r.id ? { id: r.id } : {}), text: r.text.trim() }))
    .filter((r) => r.text.length > 0)
}
