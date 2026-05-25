/**
 * AppChrome.tsx
 *
 * Global layout shell.
 * - Desktop (md+): fixed left sidebar + full-height scrollable main
 * - Mobile (<md): full-screen stack with optional bottom nav
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
  // Desktop: plain full-width layout for marketing/landing pages
  if (hideSidebar) {
    return (
      <>
        {/* Desktop - no sidebar */}
        <div className="hidden md:block min-h-screen bg-share-bg font-shareSans text-share-onBg selection:bg-share-primary/30">
          {topBanner}
          <main>{children}</main>
        </div>

        {/* Mobile */}
        <div className="md:hidden flex flex-col min-h-screen bg-share-bg font-shareSans text-share-onBg selection:bg-share-primary/30">
          {topBanner}
          <main className="flex-1">{children}</main>
          {showMobileNav && (
            <AppMobileNav
              active={mobileActive}
              plannerCurrent={plannerTabCurrent}
              plannerHref={plannerTabHref}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop layout: sidebar + scrollable main */}
      <div className="hidden md:flex h-screen overflow-hidden bg-share-bg font-shareSans text-share-onBg selection:bg-share-primary/30">
        <AppSidebar
          active={mobileActive}
          showCalendarLink={showCalendarLink}
          showHelp={showHelp}
          onHelpClick={onHelpClick}
          trailing={trailing}
        />
        {/* Main area - offset by sidebar width */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden ml-[240px]">
          {topBanner}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile layout: full-screen stack */}
      <div className="md:hidden flex flex-col min-h-screen bg-share-bg font-shareSans text-share-onBg selection:bg-share-primary/30">
        {topBanner}
        {/* Minimal mobile header - shows account menu when present */}
        {trailing && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-share-outlineVariant/20 flex-shrink-0">
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
        <main className="flex-1">{children}</main>
        {showMobileNav && (
          <AppMobileNav
            active={mobileActive}
            plannerCurrent={plannerTabCurrent}
            plannerHref={plannerTabHref}
          />
        )}
      </div>
    </>
  );
}
