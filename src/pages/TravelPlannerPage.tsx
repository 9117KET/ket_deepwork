/**
 * pages/TravelPlannerPage.tsx
 *
 * Travel Planner: single form for trip details, then generated plan (packing, stay, to-do, etc.).
 * Uses travelPlanService (mock); swap implementation there for AI when ready.
 */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { TravelPlanInput, LifeStage, BudgetPreference } from "../domain/travelTypes";
import { generateTravelPlan } from "../services/travelPlanService";
import type { TravelPlan } from "../domain/travelTypes";

const LIFE_STAGES: { value: LifeStage; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "professional", label: "Professional" },
  { value: "unemployed", label: "Unemployed" },
];

const BUDGET_OPTIONS: { value: BudgetPreference; label: string }[] = [
  { value: "budget", label: "Budget" },
  { value: "moderate", label: "Moderate" },
  { value: "comfort", label: "Comfort" },
];

const ACCOMMODATION_OPTIONS = [
  { value: "cheap" as const, label: "Cheap" },
  { value: "affordable" as const, label: "Affordable" },
  { value: "comfort" as const, label: "Comfort" },
];

const initialForm: TravelPlanInput = {
  origin: "",
  destination: "",
  purpose: "vacation",
  durationDays: 3,
  lifeStage: "professional",
  budgetPreference: "moderate",
  accommodationPreference: "affordable",
};

export function TravelPlannerPage() {
  const [form, setForm] = useState<TravelPlanInput>(initialForm);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.destination.trim()) {
      setError("Please enter where you're traveling to.");
      return;
    }
    setLoading(true);
    try {
      const result = await generateTravelPlan(form);
      setPlan(result);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAgain = () => {
    setPlan(null);
    setError(null);
  };

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
            <Link to="/finance" className="text-slate-400 hover:text-slate-200">Finance</Link>
          </nav>
        </header>

        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Travel Planner
        </h1>
        <p className="mt-1 text-textMuted">
          Get a packing list, places to visit, and practical tips for your trip.
        </p>

        {!plan ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="origin" className="block text-sm font-medium text-slate-200">
                  Where you live (city/country)
                </label>
                <input
                  id="origin"
                  type="text"
                  value={form.origin}
                  onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. Berlin, Germany"
                />
              </div>
              <div>
                <label htmlFor="destination" className="block text-sm font-medium text-slate-200">
                  Where you're traveling to *
                </label>
                <input
                  id="destination"
                  type="text"
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. Frankfurt, Germany"
                  required
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="purpose" className="block text-sm font-medium text-slate-200">
                  Trip purpose
                </label>
                <select
                  id="purpose"
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="vacation">Vacation</option>
                  <option value="work">Work</option>
                  <option value="study">Study</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-slate-200">
                  How many days?
                </label>
                <input
                  id="duration"
                  type="number"
                  min={1}
                  max={90}
                  value={form.durationDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationDays: Number(e.target.value) || 1 }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-200">Who you are</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {LIFE_STAGES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, lifeStage: value }))}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      form.lifeStage === value
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <span className="block text-sm font-medium text-slate-200">Budget</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, budgetPreference: value }))}
                      className={`rounded-md border px-3 py-1.5 text-sm ${
                        form.budgetPreference === value
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-200">Accommodation</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCOMMODATION_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, accommodationPreference: value }))}
                      className={`rounded-md border px-3 py-1.5 text-sm ${
                        form.accommodationPreference === value
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="benefits" className="block text-sm font-medium text-slate-200">
                Any travel/employment benefits? (optional)
              </label>
              <input
                id="benefits"
                type="text"
                value={form.benefits ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value || undefined }))}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g. student discount, company travel policy"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-slate-900 hover:bg-accentSoft disabled:opacity-60"
            >
              {loading ? "Generating plan…" : "Generate plan"}
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-8">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleEditAgain}
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
              >
                Edit inputs
              </button>
              <Link
                to="/travel"
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
                onClick={handleEditAgain}
              >
                New trip
              </Link>
            </div>

            <section className="rounded-xl border border-borderSubtle bg-surface p-6">
              <h2 className="text-lg font-semibold text-white">Packing list</h2>
              <ul className="mt-2 list-inside list-disc text-textMuted">
                {plan.packingList.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-borderSubtle bg-surface p-6">
              <h2 className="text-lg font-semibold text-white">Where to stay</h2>
              <p className="mt-2 text-textMuted">{plan.accommodationRecommendation}</p>
            </section>

            <section className="rounded-xl border border-borderSubtle bg-surface p-6">
              <h2 className="text-lg font-semibold text-white">Places to visit</h2>
              <ul className="mt-2 space-y-1">
                {plan.placesToVisit.map((p, i) => (
                  <li key={i}>
                    <span className="text-slate-200">{p.name}</span>
                    {p.description && (
                      <span className="ml-2 text-textMuted">— {p.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-borderSubtle bg-surface p-6">
              <h2 className="text-lg font-semibold text-white">Things to do</h2>
              <ul className="mt-2 list-inside list-disc text-textMuted">
                {plan.thingsToDo.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-borderSubtle bg-surface p-6">
              <h2 className="text-lg font-semibold text-white">Getting around</h2>
              <p className="mt-2 text-textMuted">{plan.gettingAround}</p>
            </section>

            <section className="rounded-xl border border-borderSubtle bg-surface p-6">
              <h2 className="text-lg font-semibold text-white">Prepare for the unexpected</h2>
              <p className="mt-2 text-textMuted">{plan.contingencies}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
