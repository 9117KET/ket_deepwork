/**
 * pages/FinancialPlannerPage.tsx
 *
 * Finance placeholder: Stitch-style coming-soon + desktop sidebar (links only; waitlist is UI-only).
 */

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AppChrome, appPrimaryButtonClass } from "../components/layout/AppChrome";
import { MaterialIcon } from "../components/ui/MaterialIcon";

function sideLinkClass(active: boolean) {
  return active
    ? "flex items-center gap-3 rounded-xl bg-cyan-400/10 px-4 py-3 text-sm font-shareSans text-cyan-400 transition-all duration-200"
    : "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-shareSans text-slate-500 transition-all duration-200 hover:bg-slate-800 hover:text-slate-300";
}

export function FinancialPlannerPage() {
  const [email, setEmail] = useState("");
  const [waitlistMsg, setWaitlistMsg] = useState<string | null>(null);

  return (
    <AppChrome
      headerPositionClass="top-0"
      mobileActive="finance"
      maxWidthClass="max-w-[1600px]"
    >
      <div className="flex flex-col gap-8 md:flex-row md:items-stretch">
        <aside className="sticky top-24 hidden h-fit w-64 shrink-0 flex-col gap-2 self-start rounded-none border-r border-slate-800/30 bg-slate-900/50 p-4 md:flex">
          <div className="mb-4 px-4 py-4">
            <h2 className="font-shareHeadline font-bold text-slate-100">Life Planner</h2>
            <p className="text-xs text-share-onSurfaceVariant">Daily focus hub</p>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink to="/" end className={({ isActive }) => sideLinkClass(isActive)}>
              <MaterialIcon name="home" />
              Home
            </NavLink>
            <NavLink to="/travel" className={({ isActive }) => sideLinkClass(isActive)}>
              <MaterialIcon name="flight" />
              Travel
            </NavLink>
            <NavLink to="/finance" className={({ isActive }) => sideLinkClass(isActive)}>
              <MaterialIcon name="payments" />
              Finance
            </NavLink>
            <NavLink to="/planner" className={({ isActive }) => sideLinkClass(isActive)}>
              <MaterialIcon name="trending_up" />
              Progress
            </NavLink>
            <NavLink to="/calendar" className={({ isActive }) => sideLinkClass(isActive)}>
              <MaterialIcon name="calendar_today" />
              Calendar
            </NavLink>
          </nav>
          <div className="mt-auto flex flex-col gap-1 border-t border-slate-800/30 pt-6">
            <span className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500">
              <MaterialIcon name="help" />
              Help
            </span>
            <span className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500">
              <MaterialIcon name="settings" />
              Settings
            </span>
          </div>
        </aside>

        <main className="relative flex min-h-[min(70vh,calc(100vh-8rem))] flex-1 flex-col items-center justify-center overflow-hidden py-8 md:py-12 lg:py-16">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-share-primary/5 blur-[120px]" />
          <section className="relative z-10 w-full max-w-3xl text-center">
            <div className="relative overflow-hidden rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainerLow p-10 shadow-2xl md:p-16">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-share-primary/5 to-transparent" />
              <div className="relative flex flex-col items-center gap-8">
                <div className="relative mb-2">
                  <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-share-surfaceContainer shadow-inner">
                    <MaterialIcon
                      name="account_balance_wallet"
                      filled
                      className="text-5xl text-share-primary"
                    />
                  </div>
                  <div className="absolute -right-4 -top-4 flex h-12 w-12 items-center justify-center rounded-full border border-share-outlineVariant/20 bg-share-surfaceContainerHigh shadow-lg">
                    <MaterialIcon name="monitoring" className="text-2xl text-share-secondary" />
                  </div>
                  <div className="absolute -bottom-2 -left-6 flex h-10 w-10 items-center justify-center rounded-full border border-share-outlineVariant/20 bg-share-surfaceContainerHigh shadow-lg">
                    <MaterialIcon name="savings" className="text-xl text-share-tertiary" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h1 className="font-shareHeadline text-4xl font-black tracking-tight text-share-onSurface md:text-5xl">
                    Financial Planner: <span className="text-share-primary">Coming Soon</span>
                  </h1>
                  <p className="mx-auto max-w-xl text-lg leading-relaxed text-share-onSurfaceVariant md:text-xl">
                    We&apos;re building a clutter-free way to manage your budget, savings goals, and
                    spending habits.
                  </p>
                </div>
                <div className="mt-4 w-full max-w-md rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainerHighest p-6">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-share-primary">
                    Get notified
                  </h3>
                  <form
                    className="flex flex-col gap-3 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!email.trim()) return;
                      setWaitlistMsg("You're on the list — we'll reach out when this ships.");
                      setEmail("");
                    }}
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="flex-1 rounded-xl border-none bg-share-surfaceContainer px-4 py-3 text-share-onSurface placeholder:text-share-onSurfaceVariant/50 focus:outline-none focus:ring-1 focus:ring-share-primary/40"
                    />
                    <button type="submit" className={`${appPrimaryButtonClass()} whitespace-nowrap py-3`}>
                      Join waitlist
                    </button>
                  </form>
                  {waitlistMsg && (
                    <p className="mt-3 text-left text-sm text-share-primary" role="status">
                      {waitlistMsg}
                    </p>
                  )}
                </div>
                <p className="text-xs text-share-onSurfaceVariant">
                  <Link to="/planner" className="font-bold text-share-primary hover:text-share-primaryContainer">
                    Back to Day Planner
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AppChrome>
  );
}
