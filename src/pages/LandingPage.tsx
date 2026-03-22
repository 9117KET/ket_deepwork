/**
 * pages/LandingPage.tsx
 *
 * Marketing landing — Stitch bento hub, hero glow, focus block, footer.
 */

import { Link } from "react-router-dom";
import { AppChrome, appPrimaryButtonClass, appSecondaryButtonClass } from "../components/layout/AppChrome";
import { MaterialIcon } from "../components/ui/MaterialIcon";

export function LandingPage() {
  return (
    <AppChrome
      headerPositionClass="top-0"
      mobileActive="home"
      trailing={
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/planner"
            className="hidden rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800/50 sm:block"
            aria-label="Help"
          >
            <MaterialIcon name="help" />
          </Link>
          <Link
            to="/calendar"
            className="hidden rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800/50 md:block"
            aria-label="Calendar"
          >
            <MaterialIcon name="calendar_month" />
          </Link>
          <div className="hidden h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-share-outlineVariant/20 bg-share-surfaceContainerHighest sm:flex">
            <MaterialIcon name="person" className="text-[1.1rem] text-share-onSurfaceVariant" />
          </div>
          <Link
            to="/planner"
            className={`${appPrimaryButtonClass()} hidden px-4 py-2 sm:inline-flex`}
          >
            Open planner
          </Link>
        </div>
      }
    >
      <div className="relative">
        <div className="pointer-events-none absolute left-1/2 top-4 -z-10 h-[400px] w-[min(100%,600px)] -translate-x-1/2 sky-glow" aria-hidden />

        <section className="mx-auto mb-20 max-w-5xl text-center md:mb-24">
          <h1 className="font-shareHeadline text-5xl font-black leading-[1.1] tracking-tight text-share-onSurface md:text-6xl lg:text-7xl">
            Plan your day, work,
            <br />
            trips, and money in{" "}
            <span className="text-share-primary">one place.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-share-onSurfaceVariant md:text-2xl">
            A focus-driven hub for your schedule, travel, and finances without the clutter.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 md:flex-row">
            <Link
              to="/planner"
              className={`${appPrimaryButtonClass()} group inline-flex items-center gap-2 px-8 py-4 text-lg`}
            >
              Start planning
              <MaterialIcon name="arrow_forward" className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#daily-focus-block"
              className={`${appSecondaryButtonClass()} border-transparent px-8 py-4 text-lg font-bold text-share-primary hover:bg-share-surfaceContainer/60`}
            >
              See how it works
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <Link
              to="/planner"
              className="group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainerLow p-8 transition-all duration-300 hover:border-share-primary/20 md:col-span-7"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 opacity-20 transition-transform duration-700 group-hover:scale-110">
                <MaterialIcon name="calendar_month" className="text-[12rem] text-share-primary/40" />
              </div>
              <div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-share-primary/10 text-share-primary">
                  <MaterialIcon name="target" className="text-3xl" />
                </div>
                <h2 className="mb-4 font-shareHeadline text-3xl font-bold text-share-onSurface">Day Planner</h2>
                <p className="max-w-md text-lg leading-relaxed text-share-onSurfaceVariant">
                  Organize your daily targets with clear sections and focus blocks. Cut decision fatigue.
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <span className={`${appPrimaryButtonClass()} inline-flex items-center gap-2 px-6 py-3`}>
                  Go to Day Planner
                  <MaterialIcon name="north_east" className="text-base" />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-share-outlineVariant">
                  Active focus
                </span>
              </div>
            </Link>

            <Link
              to="/finance"
              className="group relative flex h-[400px] flex-col justify-between overflow-hidden rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainerHigh p-8 transition-all duration-300 hover:border-share-primary/20 md:col-span-5"
            >
              <div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-share-primary/10 text-share-primary">
                  <MaterialIcon name="payments" className="text-3xl" />
                </div>
                <h2 className="mb-4 font-shareHeadline text-3xl font-bold text-share-onSurface">
                  Financial Planner
                </h2>
                <p className="text-lg leading-relaxed text-share-onSurfaceVariant">
                  Track growth, set budgets, and visualize your money in one calm workspace.
                </p>
              </div>
              <span
                className={`${appSecondaryButtonClass()} flex w-full items-center justify-center gap-2 border-share-primary/20 py-4 font-bold text-share-primary hover:bg-share-primary/10`}
              >
                Go to Finance
                <MaterialIcon name="north_east" className="text-base" />
              </span>
            </Link>

            <Link
              to="/travel"
              className="group relative flex min-h-[350px] flex-col items-center gap-10 overflow-hidden rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainer p-8 transition-all duration-300 hover:border-share-primary/20 md:col-span-12 md:flex-row md:p-12"
            >
              <div className="flex-1">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-share-primary/10 text-share-primary">
                  <MaterialIcon name="flight" className="text-3xl" />
                </div>
                <h2 className="mb-4 font-shareHeadline text-3xl font-bold text-share-onSurface md:text-4xl">
                  Travel Planner
                </h2>
                <p className="mb-8 max-w-xl text-lg leading-relaxed text-share-onSurfaceVariant">
                  Plan itineraries with packing lists, places, and tips—organized in high-contrast clarity.
                </p>
                <span className={`${appPrimaryButtonClass()} inline-flex items-center gap-2 px-8 py-4 text-base`}>
                  Go to Travel
                  <MaterialIcon name="north_east" className="text-base" />
                </span>
              </div>
              <div className="flex h-64 w-full flex-1 items-center justify-center rounded-xl border border-share-outlineVariant/20 bg-gradient-to-br from-share-surfaceContainerHigh to-share-surfaceContainerLow md:h-full">
                <MaterialIcon name="map" className="text-8xl text-share-primary/25" />
              </div>
            </Link>
          </div>
        </section>

        <section
          id="daily-focus-block"
          className="mx-auto mt-28 max-w-4xl scroll-mt-28"
        >
          <div className="relative overflow-hidden rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainerHighest p-10 text-center md:p-12">
            <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-share-primary/50 to-transparent" />
            <span className="mb-6 block text-xs font-bold uppercase tracking-[0.3em] text-share-primary">
              Your daily focus block
            </span>
            <h2 className="mb-6 font-shareHeadline text-4xl font-black text-share-onSurface md:text-5xl">
              Design your life with intention.
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-share-onSurfaceVariant">
              Prioritize what matters—one block at a time—for total clarity.
            </p>
            <div className="flex justify-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-share-primary/20 text-share-primary">
                <MaterialIcon name="check_circle" filled />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-share-outlineVariant/30 text-share-outlineVariant">
                <MaterialIcon name="circle" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-share-outlineVariant/30 text-share-outlineVariant">
                <MaterialIcon name="circle" />
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-24 border-t border-share-outlineVariant/10 pb-32 pt-12 md:pb-12">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h4 className="mb-2 font-shareHeadline text-xl font-black text-slate-100">Life Planner</h4>
              <p className="max-w-xs text-sm text-share-onSurfaceVariant">
                Built for people who value time and clear design in equal measure.
              </p>
            </div>
            <div className="flex flex-wrap gap-8">
              <span className="text-sm font-medium text-slate-500">Privacy</span>
              <span className="text-sm font-medium text-slate-500">Terms</span>
              <span className="text-sm font-medium text-slate-500">Support</span>
            </div>
            <p className="text-sm text-share-onSurfaceVariant">Life Planner</p>
          </div>
        </footer>
      </div>
    </AppChrome>
  );
}
