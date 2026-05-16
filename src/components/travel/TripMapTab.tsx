import { useState, useEffect, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MaterialIcon } from "../ui/MaterialIcon"
import {
  buildMapPinsFromDailyPlan,
  buildMapPinsFromPlaces,
  buildDayPolylines,
  computeBounds,
  buildNominatimUrl,
  parseNominatimResults,
  getPinLabel,
  getDayColor,
} from "../../domain/travelMap"
import type { MapPin, DayPlanWithCoords, PlaceWithCoords, ActivityWithCoords } from "../../domain/travelMap"

// Leaflet CSS - must import before using Leaflet
import "leaflet/dist/leaflet.css"

interface Props {
  tripId: Id<"travelTrips">
  dailyPlan: DayPlanWithCoords[]
  placesToVisit: PlaceWithCoords[]
  destination: string
  onPinSelect?: (day: number, activityIndex: number) => void
}

interface SearchResult {
  lat: number
  lon: number
  label: string
  placeId: number
}

export function TripMapTab({ tripId, dailyPlan, placesToVisit, destination, onPinSelect }: Props) {
  const updateTrip = useMutation(api.travel.update)

  const [MapComponents, setMapComponents] = useState<typeof import("./LeafletMap") | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<{ result: SearchResult; dayNumber: number } | null>(null)

  // Lazily load Leaflet to avoid SSR / window issues
  useEffect(() => {
    void import("./LeafletMap").then(setMapComponents)
  }, [])

  const planPins = buildMapPinsFromDailyPlan(dailyPlan)
  const placePins = buildMapPinsFromPlaces(placesToVisit)
  const allPins: MapPin[] = [...planPins, ...placePins]
  const polylines = buildDayPolylines(allPins)
  const bounds = computeBounds(allPins)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const countryHint = destination.includes(",") ? destination.split(",").pop()!.trim() : destination
      const url = buildNominatimUrl(searchQuery, countryHint)
      const res = await fetch(url, { headers: { "Accept-Language": "en" } })
      if (res.ok) {
        const data = await res.json() as unknown
        setSearchResults(parseNominatimResults(data))
      }
    } finally {
      setSearching(false)
    }
  }

  async function handleAddPin(result: SearchResult, dayNumber: number) {
    const targetDay = dailyPlan.find((d) => d.day === dayNumber)
    if (!targetDay) return

    const newActivity: ActivityWithCoords = {
      time: "12:00",
      name: result.label.split(",")[0]!.trim(),
      type: "sightseeing",
      durationMinutes: 60,
      lat: result.lat,
      lon: result.lon,
    }

    const updatedPlan = dailyPlan.map((d) =>
      d.day === dayNumber
        ? { ...d, activities: [...d.activities, newActivity] }
        : d
    )
    await updateTrip({ id: tripId, dailyPlan: updatedPlan })
    setAddingTo(null)
    setSearchResults([])
    setSearchQuery("")
  }

  const handlePinClick = useCallback((pin: MapPin) => {
    setSelectedPinId(pin.id)
    onPinSelect?.(pin.day, pin.activityIndex)
  }, [onPinSelect])

  const days = Array.from(new Set(dailyPlan.map((d) => d.day))).sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-share-outlineVariant" style={{ height: 420 }}>
        {!MapComponents ? (
          <div className="flex h-full items-center justify-center bg-share-surfaceContainer">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-share-primary border-t-transparent" />
          </div>
        ) : (
          <MapComponents.LeafletMap
            pins={allPins}
            polylines={polylines}
            bounds={bounds}
            selectedPinId={selectedPinId}
            onPinClick={handlePinClick}
            getPinLabel={(pin) => getPinLabel(allPins, pin)}
            getDayColor={getDayColor}
          />
        )}
      </div>

      {/* Day legend */}
      {days.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {days.map((day) => (
            <span
              key={day}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: getDayColor(day) }}
            >
              Day {day}
              <span className="opacity-75">({planPins.filter((p) => p.day === day).length} pins)</span>
            </span>
          ))}
          {placePins.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-share-outlineVariant text-share-onSurfaceVariant">
              + {placePins.length} suggested places
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {allPins.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-share-outlineVariant py-10 gap-3 text-share-onSurfaceVariant">
          <MaterialIcon name="location_on" className="text-[2.5rem] opacity-20" />
          <p className="text-sm">No map pins yet.</p>
          <p className="text-xs opacity-70">Search for a place below to add your first pin, or generate an AI plan to get activity suggestions.</p>
        </div>
      )}

      {/* Search */}
      <div className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer p-5 space-y-3">
        <h3 className="text-sm font-bold text-share-onBg flex items-center gap-2">
          <MaterialIcon name="search" className="text-share-primary text-[1rem]" />
          Find a Place
        </h3>
        <form onSubmit={(e) => void handleSearch(e)} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search near ${destination.split(",")[0] ?? destination}…`}
            className="flex-1 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="flex items-center gap-1 rounded-xl bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {searching ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <MaterialIcon name="search" className="text-[1rem]" />
            )}
          </button>
        </form>

        {searchResults.length > 0 && (
          <ul className="divide-y divide-share-outlineVariant/30 rounded-xl border border-share-outlineVariant overflow-hidden">
            {searchResults.map((result) => (
              <li key={result.placeId} className="px-4 py-3 bg-share-surfaceContainerLow hover:bg-share-surfaceContainerHigh transition-colors">
                <p className="text-sm text-share-onBg line-clamp-1">{result.label}</p>
                <p className="text-xs text-share-onSurfaceVariant mt-0.5">
                  {result.lat.toFixed(4)}, {result.lon.toFixed(4)}
                </p>
                {addingTo?.result.placeId === result.placeId ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-share-onSurfaceVariant">Add to day:</span>
                    {days.length === 0 ? (
                      <span className="text-xs text-share-onSurfaceVariant/60">No itinerary days yet</span>
                    ) : (
                      days.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => void handleAddPin(result, day)}
                          className="rounded-lg px-2.5 py-1 text-xs font-bold text-white"
                          style={{ backgroundColor: getDayColor(day) }}
                        >
                          Day {day}
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => setAddingTo(null)}
                      className="text-xs text-share-onSurfaceVariant hover:text-share-onBg ml-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingTo({ result, dayNumber: days[0] ?? 1 })}
                    className="mt-1.5 flex items-center gap-1 text-xs text-share-primary hover:underline"
                  >
                    <MaterialIcon name="add_location" className="text-[0.85rem]" />
                    Add to itinerary
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {searchResults.length === 0 && !searching && searchQuery && (
          <p className="text-xs text-share-onSurfaceVariant/60 text-center py-2">No results found.</p>
        )}
      </div>
    </div>
  )
}
