/**
 * services/travelPlanService.ts
 *
 * Signed-in users → Supabase Edge Function (travel-plan-generate) backed by
 * Claude Sonnet + live destination data from RestCountries and Open-Meteo.
 * Guest users → local mock (instant, no API key needed).
 */

import type { TravelPlan, TravelPlanInput } from "../domain/travelTypes";
import { supabase } from "../lib/supabase";

// ── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return { Authorization: `Bearer ${session.access_token}` };
}

// ── AI path (signed-in) ──────────────────────────────────────────────────────

async function generateAIPlan(
  input: TravelPlanInput,
  headers: Record<string, string>,
): Promise<TravelPlan> {
  const res = await supabase.functions.invoke("travel-plan-generate", {
    body: input,
    headers,
  });

  if (res.error) {
    throw new Error(
      (res.error as { message?: string }).message ?? "Travel plan generation failed",
    );
  }

  return res.data as TravelPlan;
}

// ── Mock path (guest) ────────────────────────────────────────────────────────

async function generateMockPlan(input: TravelPlanInput): Promise<TravelPlan> {
  await new Promise((r) => setTimeout(r, 800));

  const days = input.durationDays;
  const dest = input.destination.trim() || "your destination";
  const budget = input.budgetPreference;
  const acc = input.accommodationPreference;

  const packingList = [
    "Passport / ID",
    "Phone + charger",
    "Adaptor (if international)",
    "Medications",
    "Toiletries",
    ...(days > 3 ? ["Extra underwear & socks", "Light laundry bag"] : []),
    ...(days > 5 ? ["Extra shirt/top", "Comfortable walking shoes"] : []),
    "Reusable water bottle",
    "Day bag",
  ];

  const accommodationRecommendation =
    acc === "cheap"
      ? `For ${dest}, consider hostels or budget guesthouses; book in advance for better rates.`
      : acc === "affordable"
        ? `Mid-range hotels or B&Bs in ${dest} offer good value; check areas near public transport.`
        : `For comfort in ${dest}, look at well-reviewed hotels or serviced apartments in central areas.`;

  const placesToVisit = [
    { name: "Main city center / old town", description: "Orientation and first impressions." },
    { name: "Local market or food quarter", description: "Food and culture." },
    { name: "One museum or landmark", description: "Pick one that matches your interest." },
  ];

  const thingsToDo = [
    "Walk or use public transport on day one to get oriented.",
    "Try at least one local dish or café.",
    "Check opening hours and book tickets online where possible.",
  ];

  const gettingAround =
    "Use local transit apps and buy day/week passes if staying several days. Walking in the center is often fastest; keep a small map or offline map downloaded.";

  const contingencies =
    "Keep digital copies of ID and bookings. Know the address of your accommodation and the nearest hospital/pharmacy. Have a small emergency fund in local currency or a card that works abroad.";

  return {
    packingList,
    accommodationRecommendation,
    placesToVisit,
    thingsToDo,
    gettingAround,
    contingencies,
    summary: `${days}-day trip to ${dest} (${budget} budget). ${accommodationRecommendation}`,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateTravelPlan(input: TravelPlanInput): Promise<TravelPlan> {
  const headers = await getAuthHeaders();

  if (headers) {
    return generateAIPlan(input, headers);
  }

  return generateMockPlan(input);
}
