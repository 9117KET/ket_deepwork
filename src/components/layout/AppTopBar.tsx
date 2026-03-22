/**
 * Fixed top navigation — Stitch / Material styling for the whole app.
 */

import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { MaterialIcon } from "../ui/MaterialIcon";

export interface AppTopBarProps {
  /** Tailwind position class for fixed header (e.g. top-0, top-9 under a banner). */
  positionClass: string;
  showCalendarLink?: boolean;
  showHelp?: boolean;
  onHelpClick?: () => void;
  trailing?: ReactNode;
}

function navClass(isActive: boolean) {
  return isActive
    ? "border-b-2 border-share-primary pb-1 text-sm font-medium text-share-primary"
    : "text-sm font-medium text-slate-400 transition-colors duration-200 hover:text-slate-200";
}

export function AppTopBar({
  positionClass,
  showCalendarLink = false,
  showHelp = false,
  onHelpClick,
  trailing,
}: AppTopBarProps) {
  const { pathname } = useLocation();
  const calendarActive = pathname.startsWith("/calendar");

  return (
    <header
      className={`fixed ${positionClass} z-50 flex h-16 w-full items-center justify-between bg-slate-900/80 px-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-8`}
    >
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="font-shareHeadline text-xl font-black tracking-tight text-slate-100"
        >
          Life Planner
        </Link>
      </div>
      <nav className="hidden items-center gap-8 md:flex">
        <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
          Home
        </NavLink>
        <NavLink to="/planner" className={({ isActive }) => navClass(isActive)}>
          Day Planner
        </NavLink>
        <NavLink to="/travel" className={({ isActive }) => navClass(isActive)}>
          Travel
        </NavLink>
        <NavLink to="/finance" className={({ isActive }) => navClass(isActive)}>
          Finance
        </NavLink>
        {showCalendarLink && (
          <NavLink to="/calendar" className={() => navClass(calendarActive)}>
            Calendar
          </NavLink>
        )}
      </nav>
      <div className="flex items-center gap-2">
        {showHelp && (
          <button
            type="button"
            onClick={onHelpClick}
            className="rounded-xl p-2 text-slate-400 transition-all duration-200 hover:bg-slate-800/50 active:scale-90"
            aria-label="Help"
          >
            <MaterialIcon name="help" />
          </button>
        )}
        {trailing}
      </div>
    </header>
  );
}
