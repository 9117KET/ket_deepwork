/**
 * domain/travelTypes.ts
 *
 * Types for the Travel Planner: input form and generated plan output.
 * Keeps the generator contract stable for swapping mock vs AI later.
 */

export type LifeStage = "student" | "professional" | "unemployed";

export type BudgetPreference = "budget" | "moderate" | "comfort";

export interface TravelPlanInput {
  origin: string;
  destination: string;
  purpose: string;
  durationDays: number;
  lifeStage: LifeStage;
  benefits?: string;
  budgetPreference: BudgetPreference;
  accommodationPreference: "cheap" | "affordable" | "comfort";
  /** ISO date e.g. "2026-04-10" — used for weather forecast window. */
  startDate?: string;
}

export interface TravelPlan {
  packingList: string[];
  accommodationRecommendation: string;
  placesToVisit: Array<{ name: string; description?: string }>;
  thingsToDo: string[];
  gettingAround: string;
  contingencies: string;
  summary?: string;
  weatherSummary?: string;
  currencyInfo?: string;
  visaInfo?: string;
  budgetBreakdown?: string;
}
