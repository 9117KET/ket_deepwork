/**
 * AppSidebar.tsx
 *
 * Fixed left sidebar for desktop layout (md+).
 * Phones use the planner's MobileTabBar instead.
 */

import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { MaterialIcon } from "../ui/MaterialIcon";

export interface AppSidebarProps {
  showCalendarLink?: boolean;
  trailing?: ReactNode;
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  to: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "today", label: "Today", icon: "today", to: "/", end: true },
  { key: "review", label: "Review", icon: "insights", to: "/review" },
];

const CALENDAR_ITEM: NavItem = {
  key: "calendar",
  label: "Calendar",
  icon: "calendar_month",
  to: "/calendar",
};

function navItemClass(isActive: boolean) {
  return [
    "flex w-full touch-target-coarse items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
    isActive
      ? "bg-share-primary/10 text-share-primary font-semibold"
      : "text-share-onSurfaceVariant hover:bg-share-surfaceContainerHigh hover:text-share-onSurface",
  ].join(" ");
}

export function AppSidebar({ showCalendarLink = false, trailing }: AppSidebarProps) {
  const items = showCalendarLink ? [...NAV_ITEMS, CALENDAR_ITEM] : NAV_ITEMS;

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-share-outlineVariant/25 bg-[#161a1d] md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-share-outlineVariant/15">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-share-primary/15">
          <span className="h-2.5 w-2.5 rounded-full bg-share-primary" />
        </div>
        <span className="font-shareHeadline font-black text-share-onBg tracking-tight text-lg leading-none">
          Deepblock
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.end}
            className={({ isActive }) => navItemClass(isActive)}
          >
            <MaterialIcon name={item.icon} className="shrink-0 text-[1.2rem]" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {trailing && (
        <div className="px-3 pb-4 pt-2 border-t border-share-outlineVariant/15">
          <div className="flex items-center px-1 py-1">{trailing}</div>
        </div>
      )}
    </aside>
  );
}
