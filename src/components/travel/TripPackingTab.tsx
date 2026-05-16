import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MaterialIcon } from "../ui/MaterialIcon"

interface PackingItem {
  id: string
  text: string
  checked: boolean
  category: string
}

interface Props {
  tripId: Id<"travelTrips">
  packingList: PackingItem[]
}

const CATEGORY_ORDER = ["Documents", "Electronics", "Clothing", "Toiletries", "Gear", "Other"]

export function TripPackingTab({ tripId, packingList }: Props) {
  const updateTrip = useMutation(api.travel.update)

  async function toggleItem(itemId: string) {
    const updated = packingList.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    )
    await updateTrip({ id: tripId, packingList: updated })
  }

  async function deleteItem(itemId: string) {
    const updated = packingList.filter((item) => item.id !== itemId)
    await updateTrip({ id: tripId, packingList: updated })
  }

  async function addItem(category: string) {
    const text = prompt("Item name:")
    if (!text?.trim()) return
    const newItem: PackingItem = {
      id: `packing-${Date.now()}`,
      text: text.trim(),
      checked: false,
      category,
    }
    await updateTrip({ id: tripId, packingList: [...packingList, newItem] })
  }

  if (packingList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-share-onSurfaceVariant">
        <MaterialIcon name="backpack" className="text-[3rem] mb-3 opacity-30" />
        <p className="text-sm">Generate an AI plan to get a smart packing list.</p>
      </div>
    )
  }

  const checkedCount = packingList.filter((i) => i.checked).length
  const grouped = groupByCategory(packingList)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-share-onSurfaceVariant">
          {checkedCount} / {packingList.length} packed
        </p>
        <div className="h-2 flex-1 mx-4 rounded-full bg-share-surfaceContainerHigh overflow-hidden">
          <div
            className="h-full rounded-full bg-share-primary transition-all duration-300"
            style={{ width: `${packingList.length > 0 ? (checkedCount / packingList.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-medium text-share-onSurfaceVariant">
          {packingList.length > 0 ? Math.round((checkedCount / packingList.length) * 100) : 0}%
        </span>
      </div>

      {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((category) => (
        <div key={category} className="rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-share-outlineVariant bg-share-surfaceContainerLow">
            <span className="text-xs font-bold text-share-onSurfaceVariant uppercase tracking-wide">{category}</span>
            <button
              type="button"
              onClick={() => void addItem(category)}
              className="flex items-center gap-1 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
            >
              <MaterialIcon name="add" className="text-[0.9rem]" />
              Add
            </button>
          </div>
          <ul className="divide-y divide-share-outlineVariant/30">
            {grouped[category]!.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 px-5 py-2.5 hover:bg-share-surfaceContainerLow/50 transition-colors">
                <button
                  type="button"
                  onClick={() => void toggleItem(item.id)}
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    item.checked
                      ? "border-share-primary bg-share-primary text-share-onPrimary"
                      : "border-share-outlineVariant bg-transparent",
                  ].join(" ")}
                >
                  {item.checked && <MaterialIcon name="check" className="text-[0.8rem]" />}
                </button>
                <span className={`flex-1 text-sm ${item.checked ? "line-through text-share-onSurfaceVariant/50" : "text-share-onBg"}`}>
                  {item.text}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteItem(item.id)}
                  className="hidden group-hover:flex text-share-onSurfaceVariant hover:text-share-error transition-colors"
                >
                  <MaterialIcon name="close" className="text-[0.9rem]" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function groupByCategory(items: PackingItem[]): Record<string, PackingItem[]> {
  const result: Record<string, PackingItem[]> = {}
  for (const item of items) {
    const cat = item.category || "Other"
    if (!result[cat]) result[cat] = []
    result[cat]!.push(item)
  }
  return result
}
