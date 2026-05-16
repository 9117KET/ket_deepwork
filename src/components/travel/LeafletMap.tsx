import { useEffect, useRef } from "react"
import L from "leaflet"
import type { MapPin } from "../../domain/travelMap"

interface Props {
  pins: MapPin[]
  polylines: Array<{ day: number; coords: Array<[number, number]>; color: string }>
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null
  selectedPinId: string | null
  onPinClick: (pin: MapPin) => void
  getPinLabel: (pin: MapPin) => number
  getDayColor: (day: number) => string
}

export function LeafletMap({ pins, polylines, bounds, selectedPinId, onPinClick, getPinLabel, getDayColor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const polylinesRef = useRef<L.Polyline[]>([])

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sync pins and polylines whenever data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    // Remove old polylines
    polylinesRef.current.forEach((p) => p.remove())
    polylinesRef.current = []

    // Add polylines first (so markers sit on top)
    for (const line of polylines) {
      if (line.coords.length < 2) continue
      const poly = L.polyline(line.coords, {
        color: line.color,
        weight: 2.5,
        opacity: 0.6,
        dashArray: "6 4",
      }).addTo(map)
      polylinesRef.current.push(poly)
    }

    // Add markers
    for (const pin of pins) {
      const label = getPinLabel(pin)
      const color = getDayColor(pin.day)
      const isSelected = pin.id === selectedPinId

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            width: ${isSelected ? 34 : 28}px;
            height: ${isSelected ? 34 : 28}px;
            border-radius: 50%;
            background: ${color};
            border: ${isSelected ? "3px solid white" : "2px solid rgba(255,255,255,0.8)"};
            box-shadow: 0 2px 8px rgba(0,0,0,${isSelected ? "0.5" : "0.3"});
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isSelected ? "13px" : "11px"};
            font-weight: 700;
            color: white;
            font-family: system-ui, sans-serif;
            cursor: pointer;
            transition: all 0.15s;
          ">${label}</div>
        `,
        iconSize: [isSelected ? 34 : 28, isSelected ? 34 : 28],
        iconAnchor: [isSelected ? 17 : 14, isSelected ? 17 : 14],
      })

      const marker = L.marker([pin.lat, pin.lon], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 160px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${escapeHtml(pin.name)}</div>
            <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Day ${pin.day} · ${escapeHtml(pin.type)}</div>
            ${pin.notes ? `<div style="font-size: 11px; color: #444; margin-top: 4px;">${escapeHtml(pin.notes)}</div>` : ""}
          </div>
        `, { maxWidth: 240 })

      marker.on("click", () => onPinClick(pin))
      markersRef.current.set(pin.id, marker)
    }

    // Fit bounds if we have pins
    if (pins.length > 0 && bounds) {
      if (pins.length === 1) {
        map.setView([pins[0]!.lat, pins[0]!.lon], 14)
      } else {
        map.fitBounds(
          [[bounds.minLat, bounds.minLon], [bounds.maxLat, bounds.maxLon]],
          { padding: [40, 40], maxZoom: 14 }
        )
      }
    }
  }, [pins, polylines, bounds, selectedPinId, onPinClick, getPinLabel, getDayColor])

  // Pan to selected pin when selectedPinId changes
  useEffect(() => {
    if (!selectedPinId || !mapRef.current) return
    const marker = markersRef.current.get(selectedPinId)
    if (marker) {
      mapRef.current.panTo(marker.getLatLng(), { animate: true })
      marker.openPopup()
    }
  }, [selectedPinId])

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
