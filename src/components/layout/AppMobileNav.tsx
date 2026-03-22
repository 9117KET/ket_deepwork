/**
 * Bottom tab bar (mobile) — matches Stitch shell behavior app-wide.
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
    ? "flex scale-95 flex-col items-center justify-center rounded-2xl bg-share-primary/10 p-2 text-share-primary transition-transform"
    : "flex scale-95 flex-col items-center justify-center rounded-2xl p-2 text-slate-500 transition-transform active:bg-slate-800 active:scale-110";
}

export function AppMobileNav({
  active,
  plannerCurrent = false,
  plannerHref = "/planner",
}: AppMobileNavProps) {
  const plannerActive = active === "planner";

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-3xl border-t border-slate-800/50 bg-slate-900/90 px-6 pb-6 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-lg md:hidden">
      <Link to="/" className={itemClass(active === "home")}>
        <MaterialIcon name="home" />
        <span className="mt-1 font-shareSans text-[10px] font-bold uppercase tracking-widest">
          Home
        </span>
      </Link>
      {plannerCurrent ? (
        <span className={itemClass(true)}>
          <MaterialIcon name="target" />
          <span className="mt-1 font-shareSans text-[10px] font-bold uppercase tracking-widest">
            Focus
          </span>
        </span>
      ) : (
        <Link to={plannerHref} className={itemClass(plannerActive)}>
          <MaterialIcon name="target" />
          <span className="mt-1 font-shareSans text-[10px] font-bold uppercase tracking-widest">
            Planner
          </span>
        </Link>
      )}
      <Link to="/travel" className={itemClass(active === "travel")}>
        <MaterialIcon name="flight" />
        <span className="mt-1 font-shareSans text-[10px] font-bold uppercase tracking-widest">
          Travel
        </span>
      </Link>
      <Link to="/finance" className={itemClass(active === "finance")}>
        <MaterialIcon name="account_balance" />
        <span className="mt-1 font-shareSans text-[10px] font-bold uppercase tracking-widest">
          Finance
        </span>
      </Link>
    </nav>
  );
}
