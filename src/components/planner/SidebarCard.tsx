/**
 * components/planner/SidebarCard.tsx
 *
 * Lightweight collapsible wrapper for the dense desktop sidebar cards. Adds a
 * small chevron header (matching the SectionColumn chevron style) and persists
 * the collapsed state per card id via the device-local UI prefs store — never
 * AppState, so it can't trigger a Convex settings sync.
 *
 * The wrapped card renders its own full UI when expanded; collapsed, only this
 * thin header row is shown.
 */

import { useCallback, useState, type ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { getSidebarCardCollapsed, setSidebarCardCollapsed } from '../../storage/uiPrefs'

interface SidebarCardProps {
  /** Stable id used to persist the collapse choice. */
  cardId: string
  /** Short label shown in the collapse header. */
  title: string
  children: ReactNode
}

export function SidebarCard({ cardId, title, children }: SidebarCardProps) {
  const [collapsed, setCollapsed] = useState(() => getSidebarCardCollapsed(cardId) ?? false)

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      setSidebarCardCollapsed(cardId, next)
      return next
    })
  }, [cardId])

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-1.5 px-1 py-1 text-left text-xs font-medium uppercase tracking-wide text-share-onSurfaceVariant hover:text-share-onSurface"
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      >
        {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        <span className="truncate">{title}</span>
      </button>
      {!collapsed && <div className="mt-1">{children}</div>}
    </div>
  )
}
