/**
 * pages/LandingPage.tsx
 *
 * Marketing landing -- Stitch bento hub, hero glow, focus block, footer.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { AppChrome } from "../components/layout/AppChrome";
import { appPrimaryButtonClass, appSecondaryButtonClass } from "../components/layout/appClasses";
import { MaterialIcon } from "../components/ui/MaterialIcon";

const HOW_IT_WORKS_STEPS = [
  {
    icon: "bedtime",
    title: "Start with a morning check-in",
    body: "Each day begins by logging when you went to bed, when you woke up, and how many hours you want to sleep tonight. Your day blocks are built from this automatically.",
  },
  {
    icon: "checklist",
    title: "Plan your tasks by priority",
    body: "Work through six sections top to bottom: 3 MUST Todo tasks, Morning routine, High priority, Medium and Low priority, then Night routine. Each task can carry a time and duration.",
  },
  {
    icon: "timer",
    title: "Run deep work sessions",
    body: "Use the built-in Pomodoro timer to log focused work blocks. Your streak grows every day you create and complete at least one task.",
  },
  {
    icon: "insights",
    title: "Track habits, mood, and sleep",
    body: "The monthly tracking dashboard gives you a bird's-eye view of sleep, mood, and custom habits. Spot patterns and build consistency over time.",
  },
];

function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const steps = HOW_IT_WORKS_STEPS;
  const step = steps[activeStep]!;

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((s) => s + 1);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setActiveStep((s) => Math.max(0, s - 1));
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-share-outlineVariant/10 bg-share-surfaceContainerHighest p-10 text-center md:p-12">
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-share-primary/50 to-transparent" />

      <span className="mb-2 inline-block rounded-full border border-share-primary/20 bg-share-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-share-primary">
        How it works
      </span>

      <p className="mt-2 text-xs font-medium text-share-onSurfaceVariant">
        {activeStep + 1} of {steps.length}
      </p>

      <div className="mx-auto mt-8 max-w-xl">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-share-primary/10 text-share-primary">
            <MaterialIcon name={step.icon} className="text-4xl" />
          </div>
        </div>
        <h2 className="mb-4 font-shareHeadline text-2xl font-bold text-share-onSurface md:text-3xl">
          {step.title}
        </h2>
        <p className="text-base leading-relaxed text-share-onSurfaceVariant md:text-lg">
          {step.body}
        </p>
      </div>

      <div className="mt-10 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={handleBack}
          disabled={activeStep === 0}
          className={`${appSecondaryButtonClass()} border-share-outlineVariant/30 px-6 py-3 font-bold text-share-onSurface disabled:cursor-not-allowed disabled:opacity-30`}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={`${appPrimaryButtonClass()} px-8 py-3`}
        >
          {activeStep === steps.length - 1 ? "Finish" : "Next"}
        </button>
      </div>

      <div className="mt-8 flex justify-center gap-2">
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveStep(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeStep
                ? "w-6 bg-share-primary"
                : "w-2 bg-share-outlineVariant/40 hover:bg-share-outlineVariant"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

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
              href="#how-it-works"
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
                  Plan itineraries with packing lists, places, and tips, organized in high-contrast clarity.
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

        <section id="how-it-works" className="mx-auto mt-28 max-w-4xl scroll-mt-28">
          <HowItWorksSection />
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
              <a href="#" className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-200">Privacy</a>
              <a href="#" className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-200">Terms</a>
              <a href="mailto:support@lifeplanner.app" className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-200">Support</a>
            </div>
            <p className="text-sm text-share-onSurfaceVariant">Life Planner</p>
          </div>
        </footer>
      </div>
    </AppChrome>
  );
}
