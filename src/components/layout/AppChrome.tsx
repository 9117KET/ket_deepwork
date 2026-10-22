/**
 * AppChrome.tsx
 *
 * Global layout shell.
 * - Desktop (md+): fixed left sidebar + full-height scrollable main
 * - Mobile (<md): full-screen stack; the planner's MobileTabBar is the phone nav
 *
 * IMPORTANT: children are rendered exactly once. The old implementation rendered
 * children in both a desktop container and a mobile container (each hidden at the
 * other breakpoint), which caused: duplicate HTML IDs, double effects/timers,
 * double localStorage writes, and Playwright strict-mode violations.
 *
 * Layout strategy:
 *   - AppSidebar is `position:fixed` (always in the DOM, CSS-hidden on mobile).
 *   - The main area uses `md:ml-[240px]` to offset for the fixed sidebar on desktop.
 *   - Children are rendered once inside a single responsive <main>.
 */

import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

export interface AppChromeProps {
  children: ReactNode;
  showCalendarLink?: boolean;
  showChallengeLink?: boolean;
  /** AccountMenu slot - rendered in sidebar bottom on desktop, top-right on mobile. */
  trailing?: ReactNode;
  /** When true, render a plain full-width layout with no sidebar (e.g. the privacy page). */
  hideSidebar?: boolean;
}

export function AppChrome({
  children,
  showCalendarLink = false,
  showChallengeLink = false,
  trailing,
  hideSidebar = false,
}: AppChromeProps) {
  if (hideSidebar) {
    return (
      <div className="flex min-h-dvh flex-col bg-share-bg px-safe font-shareSans text-share-onBg selection:bg-share-primary/30">
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-share-bg px-safe font-shareSans text-share-onBg selection:bg-share-primary/30 md:h-dvh md:overflow-hidden">
      {/* Fixed sidebar — AppSidebar already has `hidden md:flex` so it is CSS-hidden on mobile */}
      <AppSidebar showCalendarLink={showCalendarLink} showChallengeLink={showChallengeLink} trailing={trailing} />

      {/* Main area — offset by sidebar width on desktop; full-width on mobile */}
      <div className="flex flex-col md:ml-[240px] md:h-dvh md:overflow-hidden">
        {/* Mobile-only header: app name + account menu */}
        {trailing && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-share-outlineVariant/20 flex-shrink-0 md:hidden">
            <span className="font-shareHeadline font-black text-base text-share-onBg">Deepblock</span>
            <div className="flex items-center gap-1">{trailing}</div>
          </div>
        )}

        {/* Children rendered exactly once */}
        <main className="flex-1 md:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
