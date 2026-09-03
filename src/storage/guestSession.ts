/**
 * storage/guestSession.ts
 *
 * Whether this browsing session has chosen to use the planner signed out.
 *
 * It lives here rather than in `PlannerPage`'s state because two routes now
 * need to agree about it. `/planner` asks the question; `/planner/review` never
 * did, and rendered the same planner data to anyone who opened it. That was
 * invisible while the planner was one page, but the phone's tab bar moves
 * between the two, so a guest could tap Today on Review and land on a sign-in
 * form they had already answered — or never been asked.
 *
 * Session scope, deliberately. Staying signed out is a choice about this visit,
 * not a durable account setting, and a `localStorage` flag would quietly keep
 * someone signed out on a shared machine forever.
 *
 * Every accessor is guarded: Safari in private mode and browsers set to block
 * site data throw on `sessionStorage`, and a thrown storage call must never be
 * the reason someone cannot open their planner.
 */

const GUEST_KEY = 'deepblock_guest_session'

export function isGuestSession(): boolean {
  try {
    return window.sessionStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}

export function markGuestSession(): void {
  try {
    window.sessionStorage.setItem(GUEST_KEY, '1')
  } catch {
    // Storage blocked. The caller still flips its own state, so this visit
    // works; only carrying the choice across a navigation is lost.
  }
}
