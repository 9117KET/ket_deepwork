/**
 * AppChrome.tsx
 *
 * Global layout shell.
 * - Desktop (md+): fixed left sidebar + full-height scrollable main
 * - Mobile (<md): full-screen stack with optional bottom nav
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
import { AppMobileNav, type MobileNavKey } from "./AppMobileNav";

export interface AppChromeProps {
  children: ReactNode;
  mobileActive: MobileNavKey;
  /** Row above main content area (e.g. share permission strip). */
  topBanner?: ReactNode;
  showCalendarLink?: boolean;
  showHelp?: boolean;
  onHelpClick?: () => void;
  /** AccountMenu slot - rendered in sidebar bottom on desktop, top-right on mobile. */
  trailing?: ReactNode;
  showMobileNav?: boolean;
  /** Shared planner: middle tab is current page, not a router link. */
  plannerTabCurrent?: boolean;
  plannerTabHref?: string;
  /** Extra main padding bottom when mobile nav hidden. */
  mainPb?: string;
  /** When true, render a plain full-width layout with no sidebar (for marketing pages). */
  hideSidebar?: boolean;
}

export function AppChrome({
  children,
  mobileActive,
  topBanner,
  showCalendarLink = false,
  showHelp = false,
  onHelpClick,
  trailing,
  showMobileNav = true,
  plannerTabCurrent = false,
  plannerTabHref,
  hideSidebar = false,
}: AppChromeProps) {
  // Marketing / landing pages: no sidebar, simple full-width layout.
  if (hideSidebar) {
    return (
      <div className="flex flex-col min-h-screen bg-share-bg font-shareSans text-share-onBg selection:bg-share-primary/30">
        {topBanner}
        <main className="flex-1">{children}</main>
        {showMobileNav && (
          <div className="md:hidden">
            <AppMobileNav
              active={mobileActive}
              plannerCurrent={plannerTabCurrent}
              plannerHref={plannerTabHref}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-share-bg font-shareSans text-share-onBg selection:bg-share-primary/30 md:h-screen md:overflow-hidden">
      {/* Fixed sidebar — AppSidebar already has `hidden md:flex` so it is CSS-hidden on mobile */}
      <AppSidebar
        active={mobileActive}
        showCalendarLink={showCalendarLink}
        showHelp={showHelp}
        onHelpClick={onHelpClick}
        trailing={trailing}
      />

      {/* Main area — offset by sidebar width on desktop; full-width on mobile */}
      <div className="flex flex-col md:ml-[240px] md:h-screen md:overflow-hidden">
        {/* Mobile-only header: app name + account menu / help icon */}
        {trailing && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-share-outlineVariant/20 flex-shrink-0 md:hidden">
            <span className="font-shareHeadline font-black text-base text-share-onBg">Deepblock</span>
            <div className="flex items-center gap-1">
              {showHelp && (
                <button
                  type="button"
                  onClick={onHelpClick}
                  className="rounded-xl p-2 text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh transition-colors"
                  aria-label="Help"
                >
                  <span className="material-symbols-outlined text-[1.25rem]">help</span>
                </button>
              )}
              {trailing}
            </div>
          </div>
        )}

        {topBanner}

        {/* Children rendered exactly once */}
        <main className="flex-1 md:overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom nav */}
        {showMobileNav && (
          <div className="md:hidden">
            <AppMobileNav
              active={mobileActive}
              plannerCurrent={plannerTabCurrent}
              plannerHref={plannerTabHref}
            />
          </div>
        )}
      </div>
    </div>
  );
}
