import { describe, it, expect } from "vitest"
import {
  travelCategoryToBucket,
  buildFinanceTransaction,
  getMonthKey,
  isAlreadyBridged,
} from "./financebridge"
import type { TravelExpense } from "./financebridge"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeExpense(overrides: Partial<TravelExpense> = {}): TravelExpense {
  return {
    id: "exp-1",
    date: "2026-07-15",
    category: "Food",
    amount: 25,
    currency: "EUR",
    amountBase: 25,
    note: "Ramen lunch",
    ...overrides,
  }
}

// ── travelCategoryToBucket ────────────────────────────────────────────────────

describe("travelCategoryToBucket", () => {
  it("maps Accommodation to fixed", () => {
    expect(travelCategoryToBucket("Accommodation")).toBe("fixed")
  })

  it("maps Transport to fixed", () => {
    expect(travelCategoryToBucket("Transport")).toBe("fixed")
  })

  it("maps Food to guiltFree", () => {
    expect(travelCategoryToBucket("Food")).toBe("guiltFree")
  })

  it("maps Activities to guiltFree", () => {
    expect(travelCategoryToBucket("Activities")).toBe("guiltFree")
  })

  it("maps Shopping to guiltFree", () => {
    expect(travelCategoryToBucket("Shopping")).toBe("guiltFree")
  })

  it("maps Misc to guiltFree", () => {
    expect(travelCategoryToBucket("Misc")).toBe("guiltFree")
  })
})

// ── buildFinanceTransaction ───────────────────────────────────────────────────

describe("buildFinanceTransaction", () => {
  it("uses expense note + trip name in label when note is present", () => {
    const tx = buildFinanceTransaction(makeExpense({ note: "Ramen lunch" }), "Tokyo Trip")
    expect(tx.label).toContain("Ramen lunch")
    expect(tx.label).toContain("Tokyo Trip")
  })

  it("uses category + trip name as fallback when no note", () => {
    const tx = buildFinanceTransaction(makeExpense({ note: "" }), "Tokyo Trip")
    expect(tx.label).toContain("Food")
    expect(tx.label).toContain("Tokyo Trip")
  })

  it("uses amountBase for the transaction amount", () => {
    const tx = buildFinanceTransaction(makeExpense({ amount: 3000, amountBase: 18.75 }), "Tokyo Trip")
    expect(tx.amount).toBe(18.75)
  })

  it("generates id prefixed with travel-bridge-", () => {
    const tx = buildFinanceTransaction(makeExpense({ id: "exp-123" }), "Tokyo Trip")
    expect(tx.id).toBe("travel-bridge-exp-123")
  })

  it("preserves expense date", () => {
    const tx = buildFinanceTransaction(makeExpense({ date: "2026-07-17" }), "Tokyo Trip")
    expect(tx.date).toBe("2026-07-17")
  })

  it("sets method to manual", () => {
    const tx = buildFinanceTransaction(makeExpense(), "Tokyo Trip")
    expect(tx.method).toBe("manual")
  })

  it("assigns correct bucket based on category", () => {
    const foodTx = buildFinanceTransaction(makeExpense({ category: "Food" }), "Trip")
    const accTx = buildFinanceTransaction(makeExpense({ category: "Accommodation" }), "Trip")
    expect(foodTx.bucket).toBe("guiltFree")
    expect(accTx.bucket).toBe("fixed")
  })

  it("includes trip name in notes", () => {
    const tx = buildFinanceTransaction(makeExpense(), "Summer in Tokyo")
    expect(tx.notes).toContain("Summer in Tokyo")
  })

  it("preserves category in transaction", () => {
    const tx = buildFinanceTransaction(makeExpense({ category: "Activities" }), "Trip")
    expect(tx.category).toBe("Activities")
  })
})

// ── getMonthKey ───────────────────────────────────────────────────────────────

describe("getMonthKey", () => {
  it("extracts YYYY-MM from ISO date", () => {
    expect(getMonthKey("2026-07-15")).toBe("2026-07")
  })

  it("handles end of year", () => {
    expect(getMonthKey("2026-12-31")).toBe("2026-12")
  })

  it("handles January", () => {
    expect(getMonthKey("2026-01-01")).toBe("2026-01")
  })
})

// ── isAlreadyBridged ──────────────────────────────────────────────────────────

describe("isAlreadyBridged", () => {
  it("returns false for empty transactions", () => {
    expect(isAlreadyBridged({}, "exp-1")).toBe(false)
  })

  it("returns true when transaction with bridged id exists", () => {
    const txByMonth = {
      "2026-07": [
        { id: "travel-bridge-exp-1", date: "2026-07-15", label: "Test", amount: 25, bucket: "guiltFree" as const, category: "Food", method: "manual" as const },
      ],
    }
    expect(isAlreadyBridged(txByMonth, "exp-1")).toBe(true)
  })

  it("returns false when a different expense exists", () => {
    const txByMonth = {
      "2026-07": [
        { id: "travel-bridge-exp-2", date: "2026-07-15", label: "Other", amount: 10, bucket: "guiltFree" as const, category: "Food", method: "manual" as const },
      ],
    }
    expect(isAlreadyBridged(txByMonth, "exp-1")).toBe(false)
  })

  it("searches across all months", () => {
    const txByMonth = {
      "2026-06": [{ id: "travel-bridge-exp-old", date: "2026-06-01", label: "Old", amount: 10, bucket: "guiltFree" as const, category: "Food", method: "manual" as const }],
      "2026-07": [{ id: "travel-bridge-exp-1", date: "2026-07-15", label: "Test", amount: 25, bucket: "guiltFree" as const, category: "Food", method: "manual" as const }],
    }
    expect(isAlreadyBridged(txByMonth, "exp-1")).toBe(true)
  })
})
