import { MaterialIcon } from "../ui/MaterialIcon"
import { DeepWorkWindowsCard } from "./DeepWorkWindowsCard"
import { HabitAdvisorCard } from "./HabitAdvisorCard"
import type { Id } from "../../../convex/_generated/dataModel"
import type { DayPlan } from "../../domain/deepWorkWindows"

interface GeneratedPlan {
  summary?: string
  weatherSummary?: string
  currencyInfo?: string
  visaInfo?: string
  budgetBreakdown?: string
  accommodationRecommendation?: string
  gettingAround?: string
  contingencies?: string
  placesToVisit?: Array<{ name: string; description?: string }>
  thingsToDo?: string[]
}

interface Props {
  plan: GeneratedPlan
  tripId: Id<"travelTrips">
  dailyPlan: DayPlan[]
  destination: string
  purpose: string
  durationDays: number
}

export function TripOverviewTab({ plan, tripId, dailyPlan, destination, purpose, durationDays }: Props) {
  return (
    <div className="space-y-4">
      {plan.summary && (
        <div className="rounded-2xl border border-share-primary/20 bg-share-primary/5 p-5">
          <p className="text-sm text-share-onBg leading-relaxed">{plan.summary}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {plan.weatherSummary && (
          <InfoCard icon="wb_sunny" title="Weather" content={plan.weatherSummary} color="amber" />
        )}
        {plan.currencyInfo && (
          <InfoCard icon="payments" title="Currency & Money" content={plan.currencyInfo} color="emerald" />
        )}
        {plan.visaInfo && (
          <InfoCard icon="travel_explore" title="Visa & Entry" content={plan.visaInfo} color="sky" />
        )}
        {plan.budgetBreakdown && (
          <InfoCard icon="account_balance_wallet" title="Budget Breakdown" content={plan.budgetBreakdown} color="violet" />
        )}
        {plan.accommodationRecommendation && (
          <InfoCard icon="hotel" title="Where to Stay" content={plan.accommodationRecommendation} color="teal" />
        )}
        {plan.gettingAround && (
          <InfoCard icon="directions_transit" title="Getting Around" content={plan.gettingAround} color="orange" />
        )}
        {plan.contingencies && (
          <InfoCard icon="emergency" title="Safety & Contingencies" content={plan.contingencies} color="red" />
        )}
      </div>

      {plan.placesToVisit && plan.placesToVisit.length > 0 && (
        <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5">
          <h3 className="text-sm font-bold text-share-onBg mb-3 flex items-center gap-2">
            <MaterialIcon name="location_on" className="text-share-primary" />
            Places to Visit
          </h3>
          <div className="space-y-3">
            {plan.placesToVisit.map((place, i) => (
              <div key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-share-primary/15 text-[10px] font-bold text-share-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-share-onBg">{place.name}</p>
                  {place.description && (
                    <p className="text-xs text-share-onSurfaceVariant mt-0.5">{place.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.thingsToDo && plan.thingsToDo.length > 0 && (
        <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5">
          <h3 className="text-sm font-bold text-share-onBg mb-3 flex items-center gap-2">
            <MaterialIcon name="checklist" className="text-share-primary" />
            Tips & Things to Do
          </h3>
          <ul className="space-y-2">
            {plan.thingsToDo.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-share-onBg">
                <MaterialIcon name="check_circle" className="mt-0.5 shrink-0 text-[1rem] text-emerald-400" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deepblock-native features */}
      {dailyPlan.length > 0 && (
        <DeepWorkWindowsCard tripId={tripId} dailyPlan={dailyPlan} />
      )}

      <HabitAdvisorCard destination={destination} purpose={purpose} durationDays={durationDays} />
    </div>
  )
}

const COLOR_MAP: Record<string, string> = {
  amber: "border-amber-500/20 bg-amber-500/5",
  emerald: "border-emerald-500/20 bg-emerald-500/5",
  sky: "border-sky-500/20 bg-sky-500/5",
  violet: "border-violet-500/20 bg-violet-500/5",
  teal: "border-teal-500/20 bg-teal-500/5",
  orange: "border-orange-500/20 bg-orange-500/5",
  red: "border-red-500/20 bg-red-500/5",
}
const ICON_COLOR_MAP: Record<string, string> = {
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  sky: "text-sky-400",
  violet: "text-violet-400",
  teal: "text-teal-400",
  orange: "text-orange-400",
  red: "text-red-400",
}

function InfoCard({ icon, title, content, color }: { icon: string; title: string; content: string; color: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${COLOR_MAP[color] ?? ""}`}>
      <h3 className="text-xs font-bold text-share-onBg mb-2 flex items-center gap-1.5">
        <MaterialIcon name={icon} className={`text-[1rem] ${ICON_COLOR_MAP[color] ?? ""}`} />
        {title}
      </h3>
      <p className="text-sm text-share-onBg/80 leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  )
}
