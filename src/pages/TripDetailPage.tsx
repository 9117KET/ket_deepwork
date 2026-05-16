import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useAction, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { AppChrome } from "../components/layout/AppChrome"
import { MaterialIcon } from "../components/ui/MaterialIcon"
import { TripOverviewTab } from "../components/travel/TripOverviewTab"
import { TripItineraryTab } from "../components/travel/TripItineraryTab"
import { TripPackingTab } from "../components/travel/TripPackingTab"
import { TripBudgetTab } from "../components/travel/TripBudgetTab"
import { TripMapTab } from "../components/travel/TripMapTab"
import { TripChatAssistant } from "../components/travel/TripChatAssistant"
import type { TripBudget, Expense } from "../domain/travelBudget"
import type { DayPlanWithCoords, PlaceWithCoords } from "../domain/travelMap"
import { useFinancialState } from "../storage/financialStorage"
import { buildFinanceTransaction, getMonthKey } from "../domain/financebridge"
import { usePersistentState } from "../storage/localStorageState"
import { DEFAULT_HABIT_DEFINITIONS } from "../domain/types"

type Tab = "overview" | "itinerary" | "map" | "packing" | "budget" | "notes"

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "info" },
  { id: "itinerary", label: "Itinerary", icon: "event_note" },
  { id: "map", label: "Map", icon: "map" },
  { id: "packing", label: "Packing", icon: "backpack" },
  { id: "budget", label: "Budget", icon: "account_balance_wallet" },
  { id: "notes", label: "Notes", icon: "edit_note" },
]

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const trip = useQuery(api.travel.get, tripId ? { id: tripId as Id<"travelTrips"> } : "skip")
  const generatePlan = useAction(api.travel.generatePlan)
  const injectPreTripTasks = useAction(api.travel.injectPreTripTasks)
  const updateTrip = useMutation(api.travel.update)

  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [financialState, updateFinancialState] = useFinancialState()
  const [appState] = usePersistentState()
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState("")
  const [injecting, setInjecting] = useState(false)
  const [injectResult, setInjectResult] = useState<{ count: number; dates: number } | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)

  if (trip === undefined) {
    return (
      <AppChrome headerPositionClass="top-0" mobileActive="travel">
        <div className="flex items-center justify-center py-24 text-share-onSurfaceVariant">
          <p className="text-sm">Loading…</p>
        </div>
      </AppChrome>
    )
  }

  if (trip === null) {
    return (
      <AppChrome headerPositionClass="top-0" mobileActive="travel">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <p className="text-sm text-share-onSurfaceVariant">Trip not found.</p>
          <button
            type="button"
            onClick={() => navigate("/travel")}
            className="text-xs text-share-primary hover:underline"
          >
            Back to trips
          </button>
        </div>
      </AppChrome>
    )
  }

  const notesValue = notes ?? (trip.notes ?? "")

  async function handleGenerate() {
    if (!trip) return
    setGenerating(true)
    setGenerateError("")
    try {
      await generatePlan({
        id: trip._id,
        origin: trip.origin ?? "",
        destination: trip.destination,
        purpose: trip.purpose,
        durationDays: trip.durationDays,
        lifeStage: trip.lifeStage,
        budgetPreference: trip.budgetPreference,
        accommodationPreference: trip.accommodationPreference,
        benefits: trip.benefits,
        startDate: trip.startDate,
      })
      setActiveTab("overview")
    } catch (err) {
      setGenerateError((err as Error).message ?? "Failed to generate plan")
    } finally {
      setGenerating(false)
    }
  }

  async function handleInjectTasks() {
    if (!trip?.startDate) return
    setInjecting(true)
    setInjectResult(null)
    try {
      const result = await injectPreTripTasks({
        tripId: trip._id,
        destination: trip.destination,
        purpose: trip.purpose,
        durationDays: trip.durationDays,
        lifeStage: trip.lifeStage,
        startDate: trip.startDate,
        useAI: Boolean(trip.generatedPlan),
      })
      setInjectResult({ count: result.injectedCount, dates: result.datesAffected })
    } finally {
      setInjecting(false)
    }
  }

  function handleLogExpenseToFinance(expense: Expense) {
    if (!trip) return
    const tx = buildFinanceTransaction(expense, trip.name)
    const monthKey = getMonthKey(expense.date)
    updateFinancialState((prev) => {
      const existing = prev.transactions?.[monthKey] ?? []
      if (existing.some((t) => t.id === tx.id)) return prev
      return {
        ...prev,
        transactions: {
          ...(prev.transactions ?? {}),
          [monthKey]: [...existing, tx],
        },
      }
    })
  }

  const bridgedExpenseIds = new Set(
    Object.values(financialState.transactions ?? {})
      .flat()
      .map((t) => t.id)
      .filter((id) => id.startsWith("travel-bridge-"))
      .map((id) => id.replace("travel-bridge-", ""))
  )

  async function handleSaveNotes() {
    if (!trip) return
    setSavingNotes(true)
    try {
      await updateTrip({ id: trip._id, notes: notesValue })
    } finally {
      setSavingNotes(false)
    }
  }

  const generatedPlan = trip.generatedPlan as Record<string, unknown> | undefined
  const dailyPlan = (trip.dailyPlan ?? []) as Array<{
    day: number; theme: string; activities: Array<{
      time: string; name: string; type: string; durationMinutes: number; notes?: string
    }>
  }>
  const packingList = (trip.packingList ?? []) as Array<{ id: string; text: string; checked: boolean; category: string }>

  return (
    <AppChrome headerPositionClass="top-0" mobileActive="travel" maxWidthClass="max-w-4xl">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate("/travel")}
            className="mt-0.5 rounded-lg p-1.5 text-share-onSurfaceVariant hover:text-share-onBg hover:bg-share-surfaceContainerHigh transition-colors"
          >
            <MaterialIcon name="arrow_back" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-share-onBg truncate">{trip.name}</h1>
            <p className="text-sm text-share-onSurfaceVariant flex items-center gap-1.5 mt-0.5">
              <MaterialIcon name="flight_takeoff" className="text-[0.95rem]" />
              {trip.destination}
              {trip.startDate && (
                <>
                  <span className="opacity-40">·</span>
                  {formatDate(trip.startDate)}
                  {` (${trip.durationDays} days)`}
                </>
              )}
            </p>
          </div>

          {!generatedPlan && (
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-xl bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
            >
              <MaterialIcon name="auto_awesome" className="text-[1rem]" />
              {generating ? "Generating…" : "Generate AI Plan"}
            </button>
          )}
          {generatedPlan && (
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="flex items-center gap-1 rounded-xl border border-share-outlineVariant px-3 py-2 text-xs font-medium text-share-onSurfaceVariant hover:text-share-onBg hover:border-share-primary/40 disabled:opacity-50 transition-colors shrink-0"
            >
              <MaterialIcon name="refresh" className="text-[0.9rem]" />
              {generating ? "Regenerating…" : "Regenerate"}
            </button>
          )}
        </div>

        {trip.startDate && (
          <button
            type="button"
            onClick={() => void handleInjectTasks()}
            disabled={injecting}
            title="Add preparation tasks to your Deepblock planner"
            className="flex items-center gap-1 rounded-xl border border-share-outlineVariant px-3 py-2 text-xs font-medium text-share-onSurfaceVariant hover:text-share-onBg hover:border-share-primary/40 disabled:opacity-50 transition-colors shrink-0"
          >
            <MaterialIcon name="add_task" className="text-[0.9rem]" />
            {injecting ? "Injecting…" : "Add to Planner"}
          </button>
        )}
        {injectResult && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
            <MaterialIcon name="check_circle" className="text-[0.9rem] text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">
              {injectResult.count} tasks added across {injectResult.dates} days
            </span>
            <button type="button" onClick={() => setInjectResult(null)} className="text-emerald-400/60 hover:text-emerald-400">
              <MaterialIcon name="close" className="text-[0.8rem]" />
            </button>
          </div>
        )}

        {generateError && (
          <div className="rounded-xl border border-share-error/20 bg-share-error/5 px-4 py-3">
            <p className="text-sm text-share-error">{generateError}</p>
          </div>
        )}

        {generating && (
          <div className="rounded-xl border border-share-primary/20 bg-share-primary/5 px-4 py-3 flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-share-primary border-t-transparent" />
            <p className="text-sm text-share-primary">
              Fetching live weather + country data, then calling Claude — this takes about 20 seconds…
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-share-surfaceContainerHigh text-share-onBg"
                  : "text-share-onSurfaceVariant hover:text-share-onBg",
              ].join(" ")}
            >
              <MaterialIcon name={tab.icon} className="text-[0.95rem]" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && generatedPlan && (
          <TripOverviewTab
            plan={generatedPlan as never}
            tripId={trip._id}
            dailyPlan={dailyPlan}
            destination={trip.destination}
            purpose={trip.purpose}
            durationDays={trip.durationDays}
            startDate={trip.startDate}
            endDate={trip.endDate}
            status={trip.status as "planning" | "active" | "completed"}
            plannerDayStates={appState.days}
            habits={appState.habitDefinitions ?? DEFAULT_HABIT_DEFINITIONS}
          />
        )}
        {activeTab === "overview" && !generatedPlan && (
          <div className="flex flex-col items-center justify-center py-20 text-share-onSurfaceVariant gap-4">
            <MaterialIcon name="auto_awesome" className="text-[3rem] opacity-20" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-share-onBg">No plan generated yet</p>
              <p className="text-xs">Click "Generate AI Plan" to get weather data, visa info, budget breakdown, and a day-by-day itinerary.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-xl bg-share-primary px-5 py-2.5 text-sm font-bold text-share-onPrimary hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <MaterialIcon name="auto_awesome" className="text-[1rem]" />
              {generating ? "Generating…" : "Generate AI Plan"}
            </button>
          </div>
        )}

        {activeTab === "itinerary" && (
          <TripItineraryTab
            tripId={trip._id}
            dailyPlan={dailyPlan}
            durationDays={trip.durationDays}
            startDate={trip.startDate}
          />
        )}

        {activeTab === "map" && (
          <TripMapTab
            tripId={trip._id}
            dailyPlan={dailyPlan as DayPlanWithCoords[]}
            placesToVisit={(generatedPlan ? (generatedPlan as Record<string, unknown>).placesToVisit ?? [] : []) as PlaceWithCoords[]}
            destination={trip.destination}
            onPinSelect={(day, _actIndex) => {
              setActiveTab("itinerary")
              void Promise.resolve().then(() => {
                document.getElementById(`day-${day}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
              })
            }}
          />
        )}

        {activeTab === "packing" && (
          <TripPackingTab tripId={trip._id} packingList={packingList} />
        )}

        {activeTab === "budget" && (
          <TripBudgetTab
            tripId={trip._id}
            budget={(trip.budget ?? null) as TripBudget | null}
            durationDays={trip.durationDays}
            startDate={trip.startDate}
            aiBreakdownHint={generatedPlan ? (generatedPlan as Record<string, unknown>).budgetBreakdown as string | undefined : undefined}
            onLogToFinance={handleLogExpenseToFinance}
            bridgedExpenseIds={bridgedExpenseIds}
          />
        )}

        {activeTab === "notes" && (
          <div className="space-y-3">
            <textarea
              value={notesValue}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trip notes, links, things to remember…"
              rows={12}
              className="w-full rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer px-4 py-3 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={() => void handleSaveNotes()}
              disabled={savingNotes}
              className="rounded-xl bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {savingNotes ? "Saving…" : "Save Notes"}
            </button>
          </div>
        )}
      </div>

      {/* Floating chat assistant - shown when plan is generated */}
      {generatedPlan && (
        <TripChatAssistant
          tripId={trip._id}
          destination={trip.destination}
          startDate={trip.startDate}
          durationDays={trip.durationDays}
        />
      )}
    </AppChrome>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}
