/**
 * domain/travelMap.ts
 *
 * Pure functions for travel map logic: pin building, coordinate validation,
 * day colors, Nominatim URL construction, and polyline extraction.
 * No DOM / Leaflet / React dependencies so these are fully unit-testable.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface MapPin {
  id: string
  name: string
  lat: number
  lon: number
  day: number
  activityIndex: number
  type: string
  notes?: string
}

export interface PlaceWithCoords {
  name: string
  description?: string
  lat?: number
  lon?: number
}

export interface ActivityWithCoords {
  time: string
  name: string
  type: string
  durationMinutes: number
  notes?: string
  lat?: number
  lon?: number
}

export interface DayPlanWithCoords {
  day: number
  theme: string
  activities: ActivityWithCoords[]
}

export interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  place_id: number
}

// ── Day color palette ─────────────────────────────────────────────────────────

const DAY_COLORS = [
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f59e0b", // amber
  "#ef4444", // red
  "#10b981", // emerald
  "#f97316", // orange
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
]

export function getDayColor(dayNumber: number): string {
  const index = (dayNumber - 1) % DAY_COLORS.length
  return DAY_COLORS[index] ?? DAY_COLORS[0]!
}

// ── Coordinate validation ────────────────────────────────────────────────────

export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== "number" || typeof lon !== "number") return false
  if (isNaN(lat) || isNaN(lon)) return false
  if (lat < -90 || lat > 90) return false
  if (lon < -180 || lon > 180) return false
  return true
}

// ── Pin building ─────────────────────────────────────────────────────────────

export function buildMapPinsFromDailyPlan(dailyPlan: DayPlanWithCoords[]): MapPin[] {
  const pins: MapPin[] = []
  for (const day of dailyPlan) {
    for (let i = 0; i < day.activities.length; i++) {
      const act = day.activities[i]!
      if (!isValidCoordinate(act.lat, act.lon)) continue
      pins.push({
        id: `day${day.day}-act${i}`,
        name: act.name,
        lat: act.lat!,
        lon: act.lon!,
        day: day.day,
        activityIndex: i,
        type: act.type,
        notes: act.notes,
      })
    }
  }
  return pins
}

export function buildMapPinsFromPlaces(places: PlaceWithCoords[], startDayNumber = 1): MapPin[] {
  return places
    .filter((p) => isValidCoordinate(p.lat, p.lon))
    .map((p, i) => ({
      id: `place-${i}`,
      name: p.name,
      lat: p.lat!,
      lon: p.lon!,
      day: startDayNumber,
      activityIndex: i,
      type: "sightseeing",
      notes: p.description,
    }))
}

// ── Route polyline ────────────────────────────────────────────────────────────

export function buildDayPolylines(pins: MapPin[]): Array<{ day: number; coords: Array<[number, number]>; color: string }> {
  const byDay: Record<number, MapPin[]> = {}
  for (const pin of pins) {
    if (!byDay[pin.day]) byDay[pin.day] = []
    byDay[pin.day]!.push(pin)
  }
  return Object.entries(byDay).map(([day, dayPins]) => ({
    day: Number(day),
    coords: dayPins.map((p) => [p.lat, p.lon] as [number, number]),
    color: getDayColor(Number(day)),
  }))
}

// ── Map bounds ────────────────────────────────────────────────────────────────

export function computeBounds(pins: MapPin[]): { minLat: number; maxLat: number; minLon: number; maxLon: number } | null {
  if (pins.length === 0) return null
  let minLat = pins[0]!.lat
  let maxLat = pins[0]!.lat
  let minLon = pins[0]!.lon
  let maxLon = pins[0]!.lon
  for (const pin of pins) {
    if (pin.lat < minLat) minLat = pin.lat
    if (pin.lat > maxLat) maxLat = pin.lat
    if (pin.lon < minLon) minLon = pin.lon
    if (pin.lon > maxLon) maxLon = pin.lon
  }
  return { minLat, maxLat, minLon, maxLon }
}

// ── Nominatim helpers ─────────────────────────────────────────────────────────

export function buildNominatimUrl(query: string, countryHint?: string): string {
  const q = countryHint ? `${query}, ${countryHint}` : query
  return `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`
}

export function parseNominatimResults(data: unknown): Array<{ lat: number; lon: number; label: string; placeId: number }> {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is NominatimResult => {
      if (typeof item !== "object" || item === null) return false
      const obj = item as Record<string, unknown>
      return typeof obj["lat"] === "string" && typeof obj["lon"] === "string"
    })
    .map((item) => ({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      label: item.display_name,
      placeId: item.place_id,
    }))
    .filter((r) => isValidCoordinate(r.lat, r.lon))
}

// ── Pin label (number within the day) ────────────────────────────────────────

export function getPinLabel(pins: MapPin[], pin: MapPin): number {
  const sameDayPins = pins.filter((p) => p.day === pin.day)
  return sameDayPins.findIndex((p) => p.id === pin.id) + 1
}
