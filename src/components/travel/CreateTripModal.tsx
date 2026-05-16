import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { MaterialIcon } from "../ui/MaterialIcon"

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
}

const LIFE_STAGES = [
  { value: "student", label: "Student" },
  { value: "professional", label: "Professional" },
  { value: "unemployed", label: "Unemployed" },
] as const

const BUDGET_OPTIONS = [
  { value: "budget", label: "Budget", desc: "Hostels, street food, free attractions" },
  { value: "moderate", label: "Moderate", desc: "Mid-range hotels, local restaurants" },
  { value: "comfort", label: "Comfort", desc: "Quality hotels, curated dining" },
] as const

const ACC_OPTIONS = [
  { value: "cheap", label: "Cheapest", desc: "Hostels, guesthouses" },
  { value: "affordable", label: "Affordable", desc: "3-star hotels, B&Bs" },
  { value: "comfort", label: "Comfortable", desc: "4-star hotels, boutique stays" },
] as const

export function CreateTripModal({ onClose, onCreated }: Props) {
  const createTrip = useMutation(api.travel.create)

  const [name, setName] = useState("")
  const [origin, setOrigin] = useState("")
  const [destination, setDestination] = useState("")
  const [purpose, setPurpose] = useState("")
  const [durationDays, setDurationDays] = useState(7)
  const [startDate, setStartDate] = useState("")
  const [lifeStage, setLifeStage] = useState<"student" | "professional" | "unemployed">("professional")
  const [budgetPreference, setBudgetPreference] = useState<"budget" | "moderate" | "comfort">("moderate")
  const [accommodationPreference, setAccommodationPreference] = useState<"cheap" | "affordable" | "comfort">("affordable")
  const [benefits, setBenefits] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!destination.trim()) { setError("Destination is required"); return }
    if (!purpose.trim()) { setError("Trip purpose is required"); return }
    if (durationDays < 1) { setError("Duration must be at least 1 day"); return }

    setSaving(true)
    setError("")
    try {
      const id = await createTrip({
        name: name.trim() || `Trip to ${destination.trim()}`,
        destination: destination.trim(),
        origin: origin.trim() || undefined,
        purpose: purpose.trim(),
        durationDays,
        startDate: startDate || undefined,
        lifeStage,
        budgetPreference,
        accommodationPreference,
        benefits: benefits.trim() || undefined,
      })
      onCreated(id)
    } catch (err) {
      setError((err as Error).message ?? "Failed to create trip")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-base font-bold text-share-onBg">New Trip</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-share-onSurfaceVariant mb-1">Trip name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer in Japan"
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-share-onSurfaceVariant mb-1">From (origin)</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Berlin, Germany"
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-share-onSurfaceVariant mb-1">
                Destination <span className="text-share-error">*</span>
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Tokyo, Japan"
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-share-onSurfaceVariant mb-1">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-share-onSurfaceVariant mb-1">Duration (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-share-onSurfaceVariant mb-1">
                Trip purpose <span className="text-share-error">*</span>
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. leisure & culture, remote work, study visit"
                className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-share-onSurfaceVariant mb-2">Life stage</label>
            <div className="flex gap-2">
              {LIFE_STAGES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setLifeStage(s.value)}
                  className={[
                    "flex-1 rounded-xl border py-2 text-xs font-medium transition-colors",
                    lifeStage === s.value
                      ? "border-share-primary bg-share-primary/10 text-share-primary"
                      : "border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-share-onSurfaceVariant mb-2">Budget style</label>
            <div className="flex gap-2">
              {BUDGET_OPTIONS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setBudgetPreference(b.value)}
                  className={[
                    "flex-1 flex flex-col items-center rounded-xl border py-2 px-1 text-xs font-medium transition-colors",
                    budgetPreference === b.value
                      ? "border-share-primary bg-share-primary/10 text-share-primary"
                      : "border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg",
                  ].join(" ")}
                >
                  <span className="font-semibold">{b.label}</span>
                  <span className="text-[10px] opacity-70 mt-0.5 text-center">{b.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-share-onSurfaceVariant mb-2">Accommodation</label>
            <div className="flex gap-2">
              {ACC_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAccommodationPreference(a.value)}
                  className={[
                    "flex-1 flex flex-col items-center rounded-xl border py-2 px-1 text-xs font-medium transition-colors",
                    accommodationPreference === a.value
                      ? "border-share-secondary bg-share-secondary/10 text-share-secondary"
                      : "border-share-outlineVariant text-share-onSurfaceVariant hover:text-share-onBg",
                  ].join(" ")}
                >
                  <span className="font-semibold">{a.label}</span>
                  <span className="text-[10px] opacity-70 mt-0.5 text-center">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-share-onSurfaceVariant mb-1">
              Special circumstances (optional)
            </label>
            <textarea
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="e.g. student discount card, Eurail pass, dietary restrictions"
              rows={2}
              className="w-full rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-share-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-share-primary py-2.5 text-sm font-bold text-share-onPrimary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Trip"}
          </button>
        </form>
      </div>
    </div>
  )
}
