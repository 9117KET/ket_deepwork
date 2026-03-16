/**
 * pages/LandingPage.tsx
 *
 * Modern landing page for Life Planner: hero and three hub cards (Day, Travel, Financial).
 * Full viewport layout; no auth required.
 */

import { Link } from "react-router-dom";

const HUBS = [
  {
    title: "Day Planner",
    description: "Plan your day, track progress, and stay focused. Your daily focus hub.",
    path: "/planner",
    cta: "Open Day Planner",
  },
  {
    title: "Travel Planner",
    description: "Brainstorm trips with packing lists, places to visit, and practical tips.",
    path: "/travel",
    cta: "Plan a trip",
  },
  {
    title: "Financial Planner",
    description: "Structure your budget and goals. More coming soon.",
    path: "/finance",
    cta: "Open Finance",
  },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-textPrimary font-sans">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <header className="mb-16 sm:mb-24">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight text-slate-200 hover:text-white"
          >
            Life Planner
          </Link>
        </header>

        <section className="mb-20 sm:mb-28">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl max-w-3xl">
            Plan your day, work, trips, and money in one place.
          </h1>
          <p className="mt-4 text-lg text-textMuted max-w-xl">
            A personal hub for your schedule, travel ideas, and finances without the clutter.
          </p>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {HUBS.map((hub) => (
            <Link
              key={hub.path}
              to={hub.path}
              className="group block rounded-xl border border-borderSubtle bg-surface p-6 transition hover:border-accent/50 hover:bg-surfaceAlt"
            >
              <h2 className="text-lg font-semibold text-white group-hover:text-accent">
                {hub.title}
              </h2>
              <p className="mt-2 text-sm text-textMuted">{hub.description}</p>
              <span className="mt-4 inline-block text-sm font-medium text-accent">
                {hub.cta} →
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
