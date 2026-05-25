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
  return active
    ? "flex flex-col items-center justify-center rounded-2xl bg-share-primary/15 py-3 px-4 text-share-primary transition-colors min-w-[60px]"
    : "flex flex-col items-center justify-center rounded-2xl py-3 px-4 text-slate-500 transition-colors hover:text-slate-300 active:bg-slate-800 min-w-[60px]";
}

export function AppMobileNav({
  active,
  plannerCurrent = false,
  plannerHref = "/planner",
}: AppMobileNavProps) {
  const plannerActive = active === "planner";

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-share-outlineVariant/30 bg-share-bg/95 px-4 pb-6 pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] backdrop-blur-lg md:hidden min-h-[64px]">
      <Link to="/" className={itemClass(active === "home")}>
        <MaterialIcon name="home" filled={active === "home"} />
        <span className="mt-0.5 font-shareSans text-[11px] font-semibold">
          Home
        </span>
      </Link>
      {plannerCurrent ? (
        <span className={itemClass(true)}>
          <MaterialIcon name="target" filled />
          <span className="mt-0.5 font-shareSans text-[11px] font-semibold">
            Planner
          </span>
        </span>
      ) : (
        <Link to={plannerHref} className={itemClass(plannerActive)}>
          <MaterialIcon name="target" filled={plannerActive} />
          <span className="mt-0.5 font-shareSans text-[11px] font-semibold">
            Planner
          </span>
        </Link>
      )}
      <Link to="/travel" className={itemClass(active === "travel")}>
        <MaterialIcon name="flight" filled={active === "travel"} />
        <span className="mt-0.5 font-shareSans text-[11px] font-semibold">
          Travel
        </span>
      </Link>
      <Link to="/finance" className={itemClass(active === "finance")}>
        <MaterialIcon name="account_balance" filled={active === "finance"} />
        <span className="mt-0.5 font-shareSans text-[11px] font-semibold">
          Finance
        </span>
      </Link>
    </nav>
  );
}
