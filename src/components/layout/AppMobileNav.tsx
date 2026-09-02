/**
 * Bottom tab bar (mobile) - matches Stitch shell behavior app-wide.
 */

import { Link } from "react-router-dom";
import { MaterialIcon } from "../ui/MaterialIcon";

export type MobileNavKey = "home" | "planner" | "travel" | "finance";

export interface AppMobileNavProps {
  active: MobileNavKey;
  /** When set, planner tab is non-navigating (e.g. shared link view). */
  plannerCurrent?: boolean;
  plannerHref?: string;
}

function itemClass(active: boolean) {
  // touch-target guarantees the 44px minimum even as landscape trims padding.
  const base =
    "touch-target flex flex-col items-center justify-center rounded-2xl px-4 py-3 transition-colors short:py-1.5";
  return active
    ? `${base} bg-share-primary/15 text-share-primary`
    : `${base} text-share-onSurfaceVariant/60 hover:text-share-onSurface active:bg-share-surfaceContainerHigh`;
}

export function AppMobileNav({
  active,
  plannerCurrent = false,
  plannerHref = "/planner",
}: AppMobileNavProps) {
  const plannerActive = active === "planner";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-share-outlineVariant/30 bg-share-bg/95 pb-safe-nav pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] backdrop-blur-lg md:hidden"
      style={{
        // Landscape notches cut into the left/right edges of a bottom-fixed
        // bar; a fixed element cannot inherit the shell's px-safe padding.
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <Link to="/" className={itemClass(active === "home")}>
        <MaterialIcon name="home" filled={active === "home"} />
        <span className="mt-0.5 font-shareSans text-[11px] font-semibold short:hidden">
          Home
        </span>
      </Link>
      {plannerCurrent ? (
        <span className={itemClass(true)}>
          <MaterialIcon name="target" filled />
          <span className="mt-0.5 font-shareSans text-[11px] font-semibold short:hidden">
            Planner
          </span>
        </span>
      ) : (
        <Link to={plannerHref} className={itemClass(plannerActive)}>
          <MaterialIcon name="target" filled={plannerActive} />
          <span className="mt-0.5 font-shareSans text-[11px] font-semibold short:hidden">
            Planner
          </span>
        </Link>
      )}
      <Link to="/travel" className={itemClass(active === "travel")}>
        <MaterialIcon name="flight" filled={active === "travel"} />
        <span className="mt-0.5 font-shareSans text-[11px] font-semibold short:hidden">
          Travel
        </span>
      </Link>
      <Link to="/finance" className={itemClass(active === "finance")}>
        <MaterialIcon name="account_balance" filled={active === "finance"} />
        <span className="mt-0.5 font-shareSans text-[11px] font-semibold short:hidden">
          Finance
        </span>
      </Link>
    </nav>
  );
}
