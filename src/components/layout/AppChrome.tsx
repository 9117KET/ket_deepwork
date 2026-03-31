/**
 * AppChrome.tsx
 *
 * Global shell: Stitch palette, fixed top bar, optional mobile bottom nav, main padding for fixed UI.
 */

import type { ReactNode } from "react";
import { AppTopBar } from "./AppTopBar";
import { AppMobileNav, type MobileNavKey } from "./AppMobileNav";

export interface AppChromeProps {
  children: ReactNode;
  mobileActive: MobileNavKey;
  /** Row above the top bar (e.g. share permission strip). */
  topBanner?: ReactNode;
  /** Tailwind top offset for AppTopBar when a banner sits above it. */
  headerPositionClass: string;
  showCalendarLink?: boolean;
  showHelp?: boolean;
  onHelpClick?: () => void;
  trailing?: ReactNode;
  showMobileNav?: boolean;
  /** Shared planner: middle tab is current page, not a router link. */
  plannerTabCurrent?: boolean;
  plannerTabHref?: string;
  /** Extra main padding bottom when mobile nav hidden. */
  mainPb?: string;
  /** Inner content max width (default max-w-7xl). */
  maxWidthClass?: string;
}

export function AppChrome({
  children,
  mobileActive,
  topBanner,
  headerPositionClass,
  showCalendarLink = false,
  showHelp = false,
  onHelpClick,
  trailing,
  showMobileNav = true,
  plannerTabCurrent = false,
  plannerTabHref,
  mainPb,
  maxWidthClass = "max-w-7xl",
}: AppChromeProps) {
  const pb =
    mainPb ?? (showMobileNav ? "pb-28 md:pb-10" : "pb-10");

  return (
    <div className="min-h-screen bg-share-bg font-shareSans text-share-onBg selection:bg-share-primary/30">
      {topBanner}
      <AppTopBar
        positionClass={headerPositionClass}
        showCalendarLink={showCalendarLink}
        showHelp={showHelp}
        onHelpClick={onHelpClick}
        trailing={trailing}
      />
      <div className={`mx-auto ${maxWidthClass} px-4 pt-24 md:px-8 ${pb}`}>{children}</div>
      {showMobileNav && (
        <AppMobileNav
          active={mobileActive}
          plannerCurrent={plannerTabCurrent}
          plannerHref={plannerTabHref}
        />
      )}
    </div>
  );
}
