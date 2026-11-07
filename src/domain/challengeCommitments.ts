/**
 * domain/challengeCommitments.ts
 *
 * A member's own goals and don'ts, as the client handles them. Pure.
 *
 * A removed don't is archived on the server, never deleted, so the full
 * list (archived included) is what resolves a check-in's `dontsBroken` ids.
 * Only the active ones are offered for a new check-in or shown as current.
 */

/** A goal or a don't. Removed ones are archived, never deleted, so a past mark still resolves. */
export interface Commitment {
  id: string
  text: string
  archivedAt?: number
}

/** Kept as the older name; a don't is a commitment. */
export type DontLike = Commitment

/** One row in an editor: an existing commitment keeps its id, a new one has none. */
export interface CommitmentRow {
  id?: string
  text: string
}

const UNKNOWN_DONT = 'a don’t'

/** The ones still in force, archived ones left out. */
export function activeCommitments<T extends Commitment>(list: readonly T[] | undefined): T[] {
  return (list ?? []).filter((c) => c.archivedAt === undefined)
}

/** Texts for the ids, in order. An id nobody knows reads as `fallback` rather than vanishing. */
export function resolveCommitmentTexts(ids: readonly string[], list: readonly Commitment[] | undefined, fallback: string): string[] {
  return ids.map((id) => list?.find((c) => c.id === id)?.text ?? fallback)
}

export function activeDonts<T extends DontLike>(list: readonly T[]): T[] {
  return activeCommitments(list)
}

/** Texts for the ids, in order. An id nobody knows reads as "a don't" rather than vanishing. */
export function resolveDontTexts(ids: readonly string[], list: readonly DontLike[]): string[] {
  return resolveCommitmentTexts(ids, list, UNKNOWN_DONT)
}

/**
 * A member's goals as objects. Rows written before goals had ids hold plain
 * strings; the string at index i reads as `goal-legacy-<i>`, the same id the
 * server gives it (contract: spec 03, `normalizeGoals`), so a mark made
 * before the first edit still points at the right goal after it.
 */
export function normalizeGoals(goals: readonly (string | Commitment)[] | undefined): Commitment[] {
  return (goals ?? []).map((g, i) => (typeof g === 'string' ? { id: `goal-legacy-${i}`, text: g } : g))
}

/**
 * A member's goals with ids (contract: spec 03, amended 7 Nov): the server
 * keeps `goals` as the active texts, so a client live during the deploy
 * window keeps rendering, and adds `goalItems` (archived included). Read
 * `goalItems`; a backend that predates it gives only `goals`, read as legacy
 * ids, which the server honours on the next save.
 */
export function goalItemsOf(member: { goals?: readonly (string | Commitment)[]; goalItems?: readonly Commitment[] } | null | undefined): Commitment[] {
  if (!member) return []
  return member.goalItems ? [...member.goalItems] : normalizeGoals(member.goals)
}

/**
 * "Kept 2 of 3 goals". The goals counted are the active ones plus any goal
 * archived since that was kept that day (the mark was true then), so the
 * count never reads past its total ("2 of 1"). Null when there are no active
 * goals.
 */
export function keptLine(goalsKept: readonly string[], goals: readonly Commitment[]): string | null {
  const active = activeCommitments(goals).length
  if (active === 0) return null
  const known = new Set(goals.map((g) => g.id))
  const keptIds = new Set(goalsKept.filter((id) => known.has(id)))
  const archivedKept = goals.filter((g) => g.archivedAt !== undefined && keptIds.has(g.id)).length
  const total = active + archivedKept
  return `Kept ${keptIds.size} of ${total} ${total === 1 ? 'goal' : 'goals'}`
}

/** Editor rows for the active commitments, ids kept so an edit in place stays the same one. */
export function commitmentsToRows(list: readonly Commitment[]): CommitmentRow[] {
  return activeCommitments(list).map((c) => ({ id: c.id, text: c.text }))
}

export function dontsToRows(list: readonly DontLike[]): CommitmentRow[] {
  return commitmentsToRows(list)
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
 * What `updateMyCommitments` takes for goals and for don'ts. A blank row is
 * left out, so the server archives it if it had an id; a row without an id
 * is minted fresh.
 */
export function rowsToCommitmentPayload(rows: readonly CommitmentRow[]): CommitmentRow[] {
  return rows
    .map((r) => ({ ...(r.id ? { id: r.id } : {}), text: r.text.trim() }))
    .filter((r) => r.text.length > 0)
}

export function rowsToDontPayload(rows: readonly CommitmentRow[]): CommitmentRow[] {
  return rowsToCommitmentPayload(rows)
}
