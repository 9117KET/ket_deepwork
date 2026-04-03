/**
 * pages/TravelPlannerPage.tsx
 *
 * Travel Planner: Stitch-style two-column layout (parameters + curated results).
 */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";
import {
  appCardClass,
  appPrimaryButtonClass,
  appSecondaryButtonClass,
} from "../components/layout/appClasses";
import { MaterialIcon } from "../components/ui/MaterialIcon";
import type { TravelPlanInput, LifeStage, BudgetPreference } from "../domain/travelTypes";
import { generateTravelPlan } from "../services/travelPlanService";
import type { TravelPlan } from "../domain/travelTypes";
import { useAuth } from "../contexts/AuthContext";

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

const fieldClass =
  "w-full rounded-xl border-none bg-share-surfaceContainer px-3 py-3 text-share-onSurface placeholder:text-share-onSurfaceVariant/50 focus:outline-none focus:ring-1 focus:ring-share-primary/40";

const labelClass = "text-xs font-bold uppercase tracking-widest text-share-onSurfaceVariant px-1";

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const initialForm: TravelPlanInput = {
  origin: "",
  destination: "",
  purpose: "vacation",
  durationDays: 3,
  lifeStage: "professional",
  budgetPreference: "moderate",
  accommodationPreference: "affordable",
  startDate: undefined,
};

export function TravelPlannerPage() {
  const { user } = useAuth();
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
    <AppChrome headerPositionClass="top-0" mobileActive="travel" maxWidthClass="max-w-7xl">
      <div className="mb-10">
        <h1 className="font-shareHeadline text-4xl font-black tracking-tight text-share-onSurface md:text-5xl">
          Travel Planner
        </h1>
        <p className="mt-2 max-w-xl text-share-onSurfaceVariant">
          Architect your next adventure. Define your parameters and get a curated packing list,
          places, and tips.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className={`${appCardClass()} border-share-outlineVariant/10 p-8`}>
            <h2 className="mb-6 flex items-center gap-2 font-shareHeadline text-xl font-bold text-share-onSurface">
              <MaterialIcon name="edit_note" className="text-share-primary" />
              Trip parameters
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="origin" className={labelClass}>
                    Origin
                  </label>
                  <input
                    id="origin"
                    type="text"
                    value={form.origin}
                    onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                    className={fieldClass}
                    placeholder="London, UK"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="destination" className={labelClass}>
                    Destination
                  </label>
                  <input
                    id="destination"
                    type="text"
                    value={form.destination}
                    onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                    className={fieldClass}
                    placeholder="Tokyo, JP"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="purpose" className={labelClass}>
                  Trip purpose
                </label>
                <select
                  id="purpose"
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  className={fieldClass}
                >
                  <option value="vacation">Vacation</option>
                  <option value="work">Work</option>
                  <option value="study">Study</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="duration" className={labelClass}>
                    Duration (days)
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
                    className={fieldClass}
                    placeholder="14"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className={labelClass}>Life stage</span>
                  <div className="flex flex-wrap gap-2">
                    {LIFE_STAGES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, lifeStage: value }))}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                          form.lifeStage === value
                            ? "border-share-primary bg-share-primary/15 text-share-primary"
                            : "border-share-outlineVariant/30 bg-share-surfaceContainer text-share-onSurface hover:border-share-outlineVariant"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <span className={labelClass}>Budget tier</span>
                  <div className="flex flex-wrap gap-2">
                    {BUDGET_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, budgetPreference: value }))}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                          form.budgetPreference === value
                            ? "border-share-primary bg-share-primary/15 text-share-primary"
                            : "border-share-outlineVariant/30 bg-share-surfaceContainer text-share-onSurface hover:border-share-outlineVariant"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={labelClass}>Accommodation</span>
                  <div className="flex flex-wrap gap-2">
                    {ACCOMMODATION_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, accommodationPreference: value }))}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                          form.accommodationPreference === value
                            ? "border-share-primary bg-share-primary/15 text-share-primary"
                            : "border-share-outlineVariant/30 bg-share-surfaceContainer text-share-onSurface hover:border-share-outlineVariant"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="benefits" className={labelClass}>
                    Benefits <span className="normal-case font-normal tracking-normal opacity-60">(optional)</span>
                  </label>
                  <input
                    id="benefits"
                    type="text"
                    value={form.benefits ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value || undefined }))}
                    className={fieldClass}
                    placeholder="e.g. student discount"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="startDate" className={labelClass}>
                    Start date <span className="normal-case font-normal tracking-normal opacity-60">(optional)</span>
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={form.startDate ?? ""}
                    min={TODAY_ISO}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startDate: e.target.value || undefined }))
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-share-onSurfaceVariant/60">
                  <MaterialIcon name="auto_awesome" className="text-xs text-share-primary/60" />
                  {user ? (
                    <span>AI-powered · Signed in</span>
                  ) : (
                    <span>
                      AI-powered ·{" "}
                      <span className="text-share-primary/80">Sign in for real AI results</span>
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`${appPrimaryButtonClass()} flex w-full items-center justify-center gap-2 py-4 text-base shadow-lg shadow-share-primary/10`}
                >
                  <MaterialIcon name="auto_awesome" />
                  {loading ? "Generating…" : "Generate plan"}
                </button>
              </div>
            </form>
          </section>

          <div className="flex items-center justify-between rounded-xl border border-share-outlineVariant/5 bg-share-surfaceContainer p-6">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-share-onSurface">Recent history</span>
              <span className="text-xs text-share-onSurfaceVariant">Plans you generate stay on this device</span>
            </div>
            <button
              type="button"
              onClick={handleEditAgain}
              className="flex items-center gap-1 text-sm font-bold text-share-primary hover:underline"
            >
              Reset
              <MaterialIcon name="arrow_forward" className="text-sm" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-shareHeadline text-2xl font-bold text-share-onSurface">
              Curated results
            </h2>
            {plan && (
              <button
                type="button"
                onClick={handleEditAgain}
                className="flex items-center gap-2 text-sm font-bold text-share-onSurfaceVariant transition-colors hover:text-share-primary"
              >
                <MaterialIcon name="edit" className="text-sm" />
                Edit inputs
              </button>
            )}
          </div>

          {!plan && !loading && (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-share-outlineVariant/20 py-16 text-center">
              <MaterialIcon name="map" className="mb-4 text-5xl text-share-outlineVariant/50" />
              <p className="max-w-sm text-share-onSurfaceVariant">
                Fill in trip parameters and generate a plan. Your packing list, stays, and highlights
                will appear here.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-share-outlineVariant/10 py-12 opacity-80">
              <MaterialIcon name="cloud_sync" className="mb-4 text-4xl text-share-onSurfaceVariant" />
              <p className="text-center font-medium text-share-onSurfaceVariant">
                {user ? "Researching destination & generating AI plan…" : "Curating your plan…"}
                <br />
                <span className="text-xs">
                  {user ? "Fetching live weather, currency, and local data." : "This usually takes just a moment."}
                </span>
              </p>
            </div>
          )}

          {plan && !loading && (
            <div className="space-y-6">
              <div className="relative h-64 overflow-hidden rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainer">
                <div className="absolute inset-0 bg-gradient-to-br from-share-primary/20 via-share-surfaceContainer to-share-surfaceContainerLow opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-t from-share-surfaceContainerLow via-transparent to-transparent" />
                <div className="absolute bottom-6 left-8 z-10">
                  <span className="mb-3 inline-block rounded-full bg-share-primary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-share-primary">
                    Destination profile
                  </span>
                  <h3 className="font-shareHeadline text-3xl font-black text-share-onSurface">
                    {form.destination.trim() || "Your trip"}
                  </h3>
                  <div className="mt-2 flex gap-4 text-sm text-share-onSurfaceVariant">
                    <span className="flex items-center gap-1">
                      <MaterialIcon name="schedule" className="text-xs" />
                      {form.durationDays} days
                    </span>
                  </div>
                </div>
              </div>

              <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-share-primary/10 p-2">
                    <MaterialIcon name="inventory_2" className="text-share-primary" />
                  </div>
                  <h4 className="font-bold text-share-onSurface">Packing list</h4>
                </div>
                <ul className="flex flex-col gap-3">
                  {plan.packingList.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-share-onSurfaceVariant">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-share-primary/40" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-share-primary/10 p-2">
                    <MaterialIcon name="lightbulb" className="text-share-primary" />
                  </div>
                  <h4 className="font-bold text-share-onSurface">Expert tips</h4>
                </div>
                <div className="flex flex-col gap-4">
                  {plan.thingsToDo.slice(0, 2).map((tip, i) => (
                    <div
                      key={i}
                      className="rounded-lg border-l-2 border-share-primary/40 bg-[#0c0e11] p-3"
                    >
                      <p className="text-xs italic leading-relaxed text-share-onSurface">{tip}</p>
                    </div>
                  ))}
                  {plan.thingsToDo.length === 0 && (
                    <p className="text-sm text-share-onSurfaceVariant">{plan.contingencies}</p>
                  )}
                </div>
              </div>

              <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                <h4 className="mb-6 flex items-center justify-between font-bold text-share-onSurface">
                  Places to experience
                  <span className="text-[10px] font-bold uppercase tracking-widest text-share-onSurfaceVariant">
                    Suggested
                  </span>
                </h4>
                <ul className="space-y-3">
                  {plan.placesToVisit.map((p, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-bold text-share-onSurface">{p.name}</span>
                      {p.description && (
                        <span className="ml-2 text-share-onSurfaceVariant">{p.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                <h4 className="mb-2 font-bold text-share-onSurface">Where to stay</h4>
                <p className="text-sm text-share-onSurfaceVariant">{plan.accommodationRecommendation}</p>
              </div>

              <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                <h4 className="mb-2 font-bold text-share-onSurface">Getting around</h4>
                <p className="text-sm text-share-onSurfaceVariant">{plan.gettingAround}</p>
              </div>

              {plan.weatherSummary && (
                <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="rounded-lg bg-share-primary/10 p-2">
                      <MaterialIcon name="wb_sunny" className="text-share-primary" />
                    </div>
                    <h4 className="font-bold text-share-onSurface">Weather outlook</h4>
                  </div>
                  <p className="text-sm text-share-onSurfaceVariant">{plan.weatherSummary}</p>
                </div>
              )}

              {plan.currencyInfo && (
                <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="rounded-lg bg-share-primary/10 p-2">
                      <MaterialIcon name="payments" className="text-share-primary" />
                    </div>
                    <h4 className="font-bold text-share-onSurface">Currency & money</h4>
                  </div>
                  <p className="text-sm text-share-onSurfaceVariant">{plan.currencyInfo}</p>
                </div>
              )}

              {plan.visaInfo && (
                <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="rounded-lg bg-share-primary/10 p-2">
                      <MaterialIcon name="badge" className="text-share-primary" />
                    </div>
                    <h4 className="font-bold text-share-onSurface">Entry & visa</h4>
                  </div>
                  <p className="text-sm text-share-onSurfaceVariant">{plan.visaInfo}</p>
                </div>
              )}

              {plan.budgetBreakdown && (
                <div className={`${appCardClass()} border-share-outlineVariant/10`}>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="rounded-lg bg-share-primary/10 p-2">
                      <MaterialIcon name="account_balance_wallet" className="text-share-primary" />
                    </div>
                    <h4 className="font-bold text-share-onSurface">Budget breakdown</h4>
                  </div>
                  <p className="text-sm text-share-onSurfaceVariant">{plan.budgetBreakdown}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleEditAgain} className={appSecondaryButtonClass()}>
                  Edit inputs
                </button>
                <Link to="/travel" className={appSecondaryButtonClass()} onClick={handleEditAgain}>
                  New trip
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppChrome>
  );
}
