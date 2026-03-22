/**
 * SharedPlannerShell.tsx
 *
 * Shared ?share=TOKEN view: permission banner + app top bar + planner + sidebar + mobile nav.
 */

import { useMemo, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { AppState } from "../../domain/types";
import { computeDayCompletion } from "../../domain/stats";
import { AppTopBar } from "../layout/AppTopBar";
import { AppMobileNav } from "../layout/AppMobileNav";
import { MaterialIcon } from "../ui/MaterialIcon";

function pickMainObjectiveTask(state: AppState, dayIso: string) {
  const tasks = state.days[dayIso]?.tasks ?? [];
  const roots = tasks.filter((t) => !t.parentId);
  const must = roots.filter((t) => t.sectionId === "mustDo" && !t.isDone);
  if (must.length > 0) return must[0]!;
  const anyOpen = roots.find((t) => !t.isDone);
  return anyOpen ?? null;
}

function formatPlannerDateLine(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export interface SharedPlannerShellProps {
  permission: "view" | "edit";
  appState: AppState;
  selectedDay: string;
  children: ReactNode;
  devPreview?: boolean;
}

export function SharedPlannerShell({
  permission,
  appState,
  selectedDay,
  children,
  devPreview = false,
}: SharedPlannerShellProps) {
  const { pathname, search } = useLocation();
  const plannerHref = `${pathname}${search}`;

  const completion = useMemo(
    () => computeDayCompletion(appState, selectedDay),
    [appState, selectedDay],
  );
  const pct =
    completion.totalCount <= 0
      ? 0
      : Math.max(0, Math.min(100, Math.round((completion.completedCount / completion.totalCount) * 100)));

  const dayTasks = appState.days[selectedDay]?.tasks ?? [];
  const rootTasks = dayTasks.filter((t) => !t.parentId);
  const doneRoots = rootTasks.filter((t) => t.isDone).length;
  const remainingRoots = rootTasks.length - doneRoots;

  const mainObjective = useMemo(
    () => pickMainObjectiveTask(appState, selectedDay),
    [appState, selectedDay],
  );

  const bannerText =
    permission === "edit"
      ? "Shared planner — you can add, complete, and delete tasks"
      : "Shared planner — view only";

  return (
    <div className="min-h-screen bg-share-bg font-shareSans text-share-onBg selection:bg-share-primary/30 pb-28 md:pb-24">
      <div className="fixed top-0 z-[60] flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-share-primary/20 bg-share-primary/10 px-4 py-2 backdrop-blur-md">
        <MaterialIcon name="info" />
        <p className="max-w-[min(100%,42rem)] text-center text-sm font-medium text-share-primary">
          {bannerText}
        </p>
        <span className="whitespace-nowrap rounded-full border border-share-primary/30 bg-share-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-share-primary">
          {permission === "edit" ? "Edit access" : "View only"}
        </span>
        {devPreview && (
          <span className="whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-200">
            Local preview
          </span>
        )}
      </div>

      <AppTopBar
        positionClass="top-9"
        trailing={
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-share-outlineVariant/20 bg-share-surfaceContainerHighest">
            <MaterialIcon name="person" className="text-[1.1rem] text-share-onSurfaceVariant" />
          </div>
        }
      />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pb-24 pt-32 md:px-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="mb-2 font-shareHeadline text-4xl font-black tracking-tight text-share-onSurface md:text-5xl">
                Today&apos;s Focus
              </h1>
              <p className="text-share-onSurfaceVariant">
                {formatPlannerDateLine(selectedDay)} · Shared with you
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/planner"
                className="flex items-center gap-2 rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerHigh px-5 py-3 font-bold text-share-onSurface transition-all hover:border-share-primary/40 active:scale-95"
              >
                <MaterialIcon name="add" />
                New entry
              </Link>
              <Link
                to="/planner"
                className="flex items-center gap-2 rounded-xl bg-share-primary px-6 py-3 font-bold text-share-onPrimary transition-all duration-200 hover:bg-share-primaryContainer active:scale-95"
              >
                <MaterialIcon name="open_in_new" />
                Open in app
              </Link>
            </div>
          </div>

          <section className="relative overflow-hidden rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainerHighest/40 p-8 group">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-share-primary/5 blur-3xl transition-all duration-500 group-hover:bg-share-primary/10" />
            <div className="relative flex items-center gap-3">
              <span className="rounded-lg bg-share-primary/20 p-2 text-share-primary">
                <MaterialIcon name="star" filled />
              </span>
              <span className="font-shareSans text-xs font-bold uppercase tracking-widest text-share-primary">
                Main objective
              </span>
            </div>
            <h2 className="relative mt-4 font-shareHeadline text-2xl font-bold leading-tight text-share-onSurface md:text-3xl lg:text-4xl">
              {mainObjective?.title ?? "Add a must-do in the planner to pin your top outcome here."}
            </h2>
            <p className="relative mt-3 text-sm text-share-onSurfaceVariant">
              {rootTasks.length > 0
                ? `${doneRoots} of ${rootTasks.length} top-level tasks done for this day.`
                : "No tasks yet for this day—open in the app to plan together."}
            </p>
          </section>

          {children}
        </div>

        <aside className="space-y-8 lg:col-span-4">
          <section className="rounded-xl bg-share-surfaceContainer p-6">
            <h4 className="mb-6 font-shareSans text-xs font-bold uppercase tracking-[0.2em] text-share-onSurfaceVariant">
              Shared participants
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-share-outlineVariant/50 bg-share-surfaceContainerHighest text-share-onSurfaceVariant">
                    <MaterialIcon name="supervisor_account" className="text-xl" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-share-onSurface">Owner</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-share-primary">
                      Host
                    </p>
                  </div>
                </div>
                <MaterialIcon name="shield" className="text-share-onSurfaceVariant" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-share-outlineVariant/50 bg-share-surfaceContainerHigh text-share-onSurfaceVariant">
                    <MaterialIcon name="person" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-share-onSurface">You</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-share-onSurfaceVariant">
                      {permission === "edit" ? "Editor" : "Viewer"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-share-surfaceContainer p-6">
            <div className="mb-6 flex items-center justify-between">
              <h4 className="font-shareSans text-xs font-bold uppercase tracking-[0.2em] text-share-onSurfaceVariant">
                Day progress
              </h4>
              <span className="text-sm font-bold text-share-primary">{pct}%</span>
            </div>
            <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-share-surfaceContainerHighest">
              <div
                className="h-full rounded-full bg-share-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="space-y-4 text-sm text-share-onSurfaceVariant">
              <div className="flex items-center gap-3">
                <span className="text-share-primary">
                  <MaterialIcon name="check_circle" filled />
                </span>
                <span>
                  {doneRoots} task{doneRoots !== 1 ? "s" : ""} completed
                </span>
              </div>
              <div className="flex items-center gap-3">
                <MaterialIcon name="radio_button_unchecked" />
                <span>
                  {remainingRoots} task{remainingRoots !== 1 ? "s" : ""} remaining
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-share-surfaceContainer p-6">
            <h4 className="mb-6 font-shareSans text-xs font-bold uppercase tracking-[0.2em] text-share-onSurfaceVariant">
              Recent activity
            </h4>
            <div className="relative space-y-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-px before:bg-share-outlineVariant/30">
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-share-primary bg-share-surfaceContainer" />
                <p className="text-xs font-bold text-share-onSurface">Shared link opened</p>
                <p className="mt-1 text-[10px] text-share-onSurfaceVariant">Live edits sync to the host</p>
              </div>
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-share-outlineVariant bg-share-surfaceContainer" />
                <p className="text-xs font-bold text-share-onSurface">Fine-grained history</p>
                <p className="mt-1 text-[10px] text-share-onSurfaceVariant">
                  Per-user activity feed is not stored yet—check back later.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-share-surfaceContainer p-6">
            <h4 className="mb-6 font-shareSans text-xs font-bold uppercase tracking-[0.2em] text-share-onSurfaceVariant">
              About this link
            </h4>
            <p className="text-xs leading-relaxed text-share-onSurfaceVariant">
              Changes you make here update the shared planner for everyone with the link. This sidebar
              reflects progress for the selected day.
            </p>
          </section>
        </aside>
      </main>

      <AppMobileNav active="planner" plannerCurrent plannerHref={plannerHref} />

      <div className="fixed bottom-24 right-4 z-40 md:bottom-8 md:right-8">
        <div className="flex items-center gap-2 rounded-full border border-share-outlineVariant/30 bg-share-surfaceContainerHigh px-4 py-2 shadow-2xl">
          <span className="h-2 w-2 animate-pulse rounded-full bg-share-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-share-onSurfaceVariant">
            Shared live view
          </span>
        </div>
      </div>
    </div>
  );
}
