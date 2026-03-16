/**
 * pages/FinancialPlannerPage.tsx
 *
 * Shell for the Financial Planner. Placeholder until structure is defined.
 * Same layout and nav as other app pages.
 */

import { Link } from "react-router-dom";

export function FinancialPlannerPage() {
  return (
    <div className="min-h-screen bg-background text-textPrimary">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="text-lg font-semibold text-slate-200 hover:text-white">
            Life Planner
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link to="/" className="text-slate-400 hover:text-slate-200">Home</Link>
            <Link to="/planner" className="text-slate-400 hover:text-slate-200">Day Planner</Link>
            <Link to="/travel" className="text-slate-400 hover:text-slate-200">Travel</Link>
          </nav>
        </header>

        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Financial Planner
        </h1>
        <p className="mt-1 text-textMuted">
          Budget, goals, and money in one place. Structure in progress.
        </p>

        <div className="mt-12 rounded-xl border border-borderSubtle bg-surface p-8 text-center">
          <p className="text-textMuted">
            Financial planning is coming soon. You’ll be able to track budget, set goals, and
            prepare for trips and everyday spending here.
          </p>
        </div>
      </div>
    </div>
  );
}
