import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MaterialIcon } from "../ui/MaterialIcon"

interface Activity {
  time: string
  name: string
  type: string
  durationMinutes: number
  notes?: string
}

interface DayPlan {
  day: number
  theme: string
  activities: Activity[]
}

interface Props {
  tripId: Id<"travelTrips">
  dailyPlan: DayPlan[]
  durationDays: number
  startDate?: string
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  sightseeing: { icon: "photo_camera", color: "text-sky-400" },
  food: { icon: "restaurant", color: "text-amber-400" },
  transport: { icon: "directions_transit", color: "text-orange-400" },
  logistics: { icon: "check_circle", color: "text-share-onSurfaceVariant" },
  leisure: { icon: "spa", color: "text-emerald-400" },
  deep_work: { icon: "laptop", color: "text-share-primary" },
}

export function TripItineraryTab({ tripId, dailyPlan, durationDays, startDate }: Props) {
  const updateTrip = useMutation(api.travel.update)
  const [editingActivity, setEditingActivity] = useState<{ dayIndex: number; actIndex: number } | null>(null)
  const [editName, setEditName] = useState("")
  const [editNotes, setEditNotes] = useState("")

  const days = buildDays(dailyPlan, durationDays, startDate)

  function startEdit(dayIndex: number, actIndex: number, activity: Activity) {
    setEditingActivity({ dayIndex, actIndex })
    setEditName(activity.name)
    setEditNotes(activity.notes ?? "")
  }

  async function saveEdit() {
    if (!editingActivity) return
    const { dayIndex, actIndex } = editingActivity
    const updated = days.map((d, di) => ({
      ...d,
      activities: d.activities.map((a, ai) =>
        di === dayIndex && ai === actIndex ? { ...a, name: editName, notes: editNotes } : a
      ),
    }))
    await updateTrip({ id: tripId, dailyPlan: updated })
    setEditingActivity(null)
  }

  async function deleteActivity(dayIndex: number, actIndex: number) {
    const updated = days.map((d, di) => ({
      ...d,
      activities: di === dayIndex ? d.activities.filter((_, ai) => ai !== actIndex) : d.activities,
    }))
    await updateTrip({ id: tripId, dailyPlan: updated })
  }

  async function addActivity(dayIndex: number) {
    const updated = days.map((d, di) => {
      if (di !== dayIndex) return d
      return {
        ...d,
        activities: [
          ...d.activities,
          { time: "12:00", name: "New activity", type: "leisure", durationMinutes: 60, notes: "" },
        ],
      }
    })
    await updateTrip({ id: tripId, dailyPlan: updated })
  }

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-share-onSurfaceVariant">
        <MaterialIcon name="event_note" className="text-[3rem] mb-3 opacity-30" />
        <p className="text-sm">Generate an AI plan to see your day-by-day itinerary.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {days.map((day, dayIndex) => (
        <div key={dayIndex} className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-share-outlineVariant bg-share-surfaceContainerLow">
            <div>
              <span className="text-xs font-bold text-share-primary uppercase tracking-wide">
                Day {day.day}
                {day.dateLabel ? ` — ${day.dateLabel}` : ""}
              </span>
              {day.theme && (
                <p className="text-sm font-semibold text-share-onBg mt-0.5">{day.theme}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void addActivity(dayIndex)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-share-onSurfaceVariant border border-share-outlineVariant hover:text-share-onBg hover:border-share-primary/40 transition-colors"
            >
              <MaterialIcon name="add" className="text-[0.9rem]" />
              Add
            </button>
          </div>

          <div className="divide-y divide-share-outlineVariant/30">
            {day.activities.length === 0 && (
              <p className="px-5 py-4 text-xs text-share-onSurfaceVariant/60 italic">No activities yet.</p>
            )}
            {day.activities.map((activity, actIndex) => {
              const isEditing = editingActivity?.dayIndex === dayIndex && editingActivity?.actIndex === actIndex
              const typeCfg = TYPE_CONFIG[activity.type] ?? { icon: "circle", color: "text-share-onSurfaceVariant" }

              if (isEditing) {
                return (
                  <div key={actIndex} className="px-5 py-3 bg-share-surfaceContainerHigh space-y-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-share-primary bg-share-surfaceContainer px-3 py-1.5 text-sm text-share-onBg focus:outline-none"
                    />
                    <input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full rounded-lg border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-1.5 text-xs text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        className="rounded-lg bg-share-primary px-3 py-1 text-xs font-bold text-share-onPrimary"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingActivity(null)}
                        className="rounded-lg border border-share-outlineVariant px-3 py-1 text-xs text-share-onSurfaceVariant"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={actIndex} className="group flex items-start gap-3 px-5 py-3 hover:bg-share-surfaceContainerLow/50 transition-colors">
                  <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0 w-10">
                    <span className="text-[11px] font-medium text-share-onSurfaceVariant">{activity.time}</span>
                    <MaterialIcon name={typeCfg.icon} className={`text-[1rem] ${typeCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-share-onBg">{activity.name}</p>
                    {activity.notes && (
                      <p className="text-xs text-share-onSurfaceVariant mt-0.5">{activity.notes}</p>
                    )}
                    <span className="mt-1 inline-block text-[10px] text-share-onSurfaceVariant/60">
                      {activity.durationMinutes} min · {activity.type}
                    </span>
                  </div>
                  <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(dayIndex, actIndex, activity)}
                      className="rounded p-1 text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
                    >
                      <MaterialIcon name="edit" className="text-[0.9rem]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteActivity(dayIndex, actIndex)}
                      className="rounded p-1 text-share-onSurfaceVariant hover:text-share-error transition-colors"
                    >
                      <MaterialIcon name="delete_outline" className="text-[0.9rem]" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

interface DayWithLabel extends DayPlan {
  dateLabel?: string
}

function buildDays(dailyPlan: DayPlan[], durationDays: number, startDate?: string): DayWithLabel[] {
  if (dailyPlan.length > 0) {
    return dailyPlan.map((d) => ({
      ...d,
      dateLabel: startDate ? formatDayDate(startDate, d.day - 1) : undefined,
    }))
  }
  return Array.from({ length: durationDays }, (_, i) => ({
    day: i + 1,
    theme: "",
    activities: [],
    dateLabel: startDate ? formatDayDate(startDate, i) : undefined,
  }))
}

function formatDayDate(startIso: string, offset: number): string {
  const d = new Date(startIso + "T00:00:00")
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })
}
