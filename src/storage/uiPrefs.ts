/**
 * storage/uiPrefs.ts
 *
 * Tiny, dedicated localStorage store for *UI-only* preferences (collapse state
 * of planner sections and sidebar cards). Kept deliberately separate from
 * `localStorageState.ts` / AppState so these reads/writes never trigger a
 * Convex settings sync — collapse state is a device-local view concern, not
 * user data, and must not contribute to the I/O quota churn AppState sync does.
 *
 * Shape (key: deepblock_ui_prefs_v1):
 *   {
 *     sectionCollapsed: Record<sectionId, boolean>,
 *     sidebarCardCollapsed: Record<cardId, boolean>
 *   }
 *
 * A `false`/absent value means "expanded". We only persist explicit user
 * choices; auto-expand-on-active and the collapse prompt still drive runtime
 * behavior on top of this baseline.
 */

const UI_PREFS_KEY = "deepblock_ui_prefs_v1"

interface UiPrefs {
  sectionCollapsed: Record<string, boolean>
  sidebarCardCollapsed: Record<string, boolean>
}

const EMPTY_PREFS: UiPrefs = {
  sectionCollapsed: {},
  sidebarCardCollapsed: {},
}

function readPrefs(): UiPrefs {
  if (typeof window === "undefined") return { ...EMPTY_PREFS }
  try {
    const raw = window.localStorage.getItem(UI_PREFS_KEY)
    if (!raw) return { ...EMPTY_PREFS }
    const parsed = JSON.parse(raw) as Partial<UiPrefs>
    return {
      sectionCollapsed:
        parsed.sectionCollapsed && typeof parsed.sectionCollapsed === "object"
          ? parsed.sectionCollapsed
          : {},
      sidebarCardCollapsed:
        parsed.sidebarCardCollapsed && typeof parsed.sidebarCardCollapsed === "object"
          ? parsed.sidebarCardCollapsed
          : {},
    }
  } catch {
    return { ...EMPTY_PREFS }
  }
}

function writePrefs(prefs: UiPrefs) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore quota / private-mode errors
  }
}

// ─── Section collapse state ──────────────────────────────────────────────────

/** Returns the persisted collapse choice for a section, or undefined if none. */
export function getSectionCollapsed(sectionId: string): boolean | undefined {
  return readPrefs().sectionCollapsed[sectionId]
}

/** Persist (or clear) the collapse choice for a section. */
export function setSectionCollapsed(sectionId: string, collapsed: boolean) {
  const prefs = readPrefs()
  prefs.sectionCollapsed = { ...prefs.sectionCollapsed, [sectionId]: collapsed }
  writePrefs(prefs)
}

// ─── Sidebar card collapse state ─────────────────────────────────────────────

/** Returns the persisted collapse choice for a sidebar card, or undefined. */
export function getSidebarCardCollapsed(cardId: string): boolean | undefined {
  return readPrefs().sidebarCardCollapsed[cardId]
}

/** Persist (or clear) the collapse choice for a sidebar card. */
export function setSidebarCardCollapsed(cardId: string, collapsed: boolean) {
  const prefs = readPrefs()
  prefs.sidebarCardCollapsed = { ...prefs.sidebarCardCollapsed, [cardId]: collapsed }
  writePrefs(prefs)
}
