import { describe, it, expect } from "vitest"
import {
  BUDGET_CATEGORIES,
  buildDefaultAllocations,
  totalSpent,
  spentByCategory,
  remainingBudget,
  categoryBudgetStatus,
  dailyBudgetRate,
  dailySpendRate,
  budgetPaceStatus,
  daysBetween,
  createExpense,
  expensesByDate,
} from "./travelBudget"
import type { TripBudget, Expense } from "./travelBudget"

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: `exp-${Math.random()}`,
    date: "2026-07-15",
    category: "Food",
    amount: 20,
    currency: "EUR",
    amountBase: 20,
    note: "Lunch",
    ...overrides,
  }
}

function makeBudget(overrides: Partial<TripBudget> = {}): TripBudget {
  return {
    totalBudget: 1000,
    currency: "EUR",
    allocations: {
      Accommodation: 350,
      Food: 250,
      Transport: 150,
      Activities: 150,
      Shopping: 50,
      Misc: 50,
    },
    expenses: [],
    ...overrides,
  }
}

// ── BUDGET_CATEGORIES ────────────────────────────────────────────────────────

describe("BUDGET_CATEGORIES", () => {
  it("contains all expected categories", () => {
    expect(BUDGET_CATEGORIES).toContain("Accommodation")
    expect(BUDGET_CATEGORIES).toContain("Food")
    expect(BUDGET_CATEGORIES).toContain("Transport")
    expect(BUDGET_CATEGORIES).toContain("Activities")
    expect(BUDGET_CATEGORIES).toContain("Shopping")
    expect(BUDGET_CATEGORIES).toContain("Misc")
  })

  it("has exactly 6 categories", () => {
    expect(BUDGET_CATEGORIES.length).toBe(6)
  })
})

// ── buildDefaultAllocations ──────────────────────────────────────────────────

describe("buildDefaultAllocations", () => {
  it("allocates all 6 categories", () => {
    const allocs = buildDefaultAllocations(1000)
    expect(Object.keys(allocs).length).toBe(6)
  })

  it("allocations sum to approximately total (rounding diff < 10)", () => {
    const total = 1000
    const allocs = buildDefaultAllocations(total)
    const sum = Object.values(allocs).reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - total)).toBeLessThan(10)
  })

  it("accommodation gets the largest share", () => {
    const allocs = buildDefaultAllocations(1000)
    const acc = allocs["Accommodation"] ?? 0
    for (const cat of ["Food", "Transport", "Activities", "Shopping", "Misc"] as const) {
      expect(acc).toBeGreaterThanOrEqual(allocs[cat] ?? 0)
    }
  })

  it("scales proportionally with different totals", () => {
    const a = buildDefaultAllocations(1000)
    const b = buildDefaultAllocations(2000)
    expect((b["Accommodation"] ?? 0) / (a["Accommodation"] ?? 1)).toBeCloseTo(2, 0)
  })

  it("returns zero allocations for zero total", () => {
    const allocs = buildDefaultAllocations(0)
    expect(Object.values(allocs).every((v) => v === 0)).toBe(true)
  })
})

// ── totalSpent ───────────────────────────────────────────────────────────────

describe("totalSpent", () => {
  it("returns 0 for empty expenses", () => {
    expect(totalSpent([])).toBe(0)
  })

  it("sums amountBase values correctly", () => {
    const expenses = [
      makeExpense({ amountBase: 50 }),
      makeExpense({ amountBase: 30 }),
      makeExpense({ amountBase: 20 }),
    ]
    expect(totalSpent(expenses)).toBe(100)
  })

  it("handles single expense", () => {
    expect(totalSpent([makeExpense({ amountBase: 75 })])).toBe(75)
  })

  it("uses amountBase not amount (for currency conversion)", () => {
    const exp = makeExpense({ amount: 100, amountBase: 90 })
    expect(totalSpent([exp])).toBe(90)
  })
})

// ── spentByCategory ──────────────────────────────────────────────────────────

describe("spentByCategory", () => {
  it("returns zero for all categories on empty expenses", () => {
    const result = spentByCategory([])
    for (const cat of BUDGET_CATEGORIES) {
      expect(result[cat]).toBe(0)
    }
  })

  it("groups expenses by category correctly", () => {
    const expenses = [
      makeExpense({ category: "Food", amountBase: 20 }),
      makeExpense({ category: "Food", amountBase: 15 }),
      makeExpense({ category: "Transport", amountBase: 10 }),
    ]
    const result = spentByCategory(expenses)
    expect(result["Food"]).toBe(35)
    expect(result["Transport"]).toBe(10)
    expect(result["Accommodation"]).toBe(0)
  })

  it("all 6 categories are always present in result", () => {
    const result = spentByCategory([makeExpense({ category: "Food", amountBase: 10 })])
    expect(Object.keys(result).length).toBeGreaterThanOrEqual(6)
  })
})

// ── remainingBudget ──────────────────────────────────────────────────────────

describe("remainingBudget", () => {
  it("returns full budget when no expenses", () => {
    const budget = makeBudget({ totalBudget: 500, expenses: [] })
    expect(remainingBudget(budget)).toBe(500)
  })

  it("subtracts total spent from total budget", () => {
    const budget = makeBudget({
      totalBudget: 500,
      expenses: [makeExpense({ amountBase: 100 }), makeExpense({ amountBase: 50 })],
    })
    expect(remainingBudget(budget)).toBe(350)
  })

  it("returns negative when over budget", () => {
    const budget = makeBudget({
      totalBudget: 100,
      expenses: [makeExpense({ amountBase: 150 })],
    })
    expect(remainingBudget(budget)).toBe(-50)
  })
})

// ── categoryBudgetStatus ─────────────────────────────────────────────────────

describe("categoryBudgetStatus", () => {
  it("returns 'ok' when well under budget", () => {
    expect(categoryBudgetStatus("Food", 50, 200)).toBe("ok")
  })

  it("returns 'warning' when 80%+ of allocation used", () => {
    expect(categoryBudgetStatus("Food", 160, 200)).toBe("warning")
    expect(categoryBudgetStatus("Food", 180, 200)).toBe("warning")
  })

  it("returns 'over' when at or above allocation", () => {
    expect(categoryBudgetStatus("Food", 200, 200)).toBe("over")
    expect(categoryBudgetStatus("Food", 250, 200)).toBe("over")
  })

  it("returns 'ok' when allocated is 0", () => {
    expect(categoryBudgetStatus("Food", 50, 0)).toBe("ok")
  })

  it("boundary: exactly 80% is warning", () => {
    expect(categoryBudgetStatus("Food", 80, 100)).toBe("warning")
  })

  it("boundary: just under 80% is ok", () => {
    expect(categoryBudgetStatus("Food", 79, 100)).toBe("ok")
  })
})

// ── dailyBudgetRate ──────────────────────────────────────────────────────────

describe("dailyBudgetRate", () => {
  it("divides total by duration", () => {
    const budget = makeBudget({ totalBudget: 700 })
    expect(dailyBudgetRate(budget, 7)).toBe(100)
  })

  it("returns 0 for zero duration", () => {
    const budget = makeBudget({ totalBudget: 700 })
    expect(dailyBudgetRate(budget, 0)).toBe(0)
  })

  it("handles fractional result", () => {
    const budget = makeBudget({ totalBudget: 1000 })
    expect(dailyBudgetRate(budget, 3)).toBeCloseTo(333.33, 1)
  })
})

// ── dailySpendRate ───────────────────────────────────────────────────────────

describe("dailySpendRate", () => {
  it("returns 0 for no expenses", () => {
    expect(dailySpendRate([], "2026-07-01", "2026-07-03")).toBe(0)
  })

  it("divides total by days elapsed", () => {
    const expenses = [
      makeExpense({ date: "2026-07-01", amountBase: 100 }),
      makeExpense({ date: "2026-07-02", amountBase: 100 }),
    ]
    const rate = dailySpendRate(expenses, "2026-07-01", "2026-07-02")
    expect(rate).toBe(100)
  })

  it("uses at least 1 day to avoid division by zero", () => {
    const expenses = [makeExpense({ amountBase: 50 })]
    const rate = dailySpendRate(expenses, "2026-07-01", "2026-07-01")
    expect(rate).toBe(50)
  })
})

// ── budgetPaceStatus ─────────────────────────────────────────────────────────

describe("budgetPaceStatus", () => {
  it("returns on_track when actual daily ≈ target daily", () => {
    const budget = makeBudget({
      totalBudget: 700,
      expenses: [makeExpense({ date: "2026-07-01", amountBase: 100 })],
    })
    const status = budgetPaceStatus(budget, 7, "2026-07-01", "2026-07-01")
    expect(status).toBe("on_track")
  })

  it("returns over_pace when spending >110% of target rate", () => {
    const budget = makeBudget({
      totalBudget: 700,
      expenses: [makeExpense({ date: "2026-07-01", amountBase: 250 })],
    })
    const status = budgetPaceStatus(budget, 7, "2026-07-01", "2026-07-01")
    expect(status).toBe("over_pace")
  })

  it("returns under_pace when spending <85% of target rate", () => {
    const budget = makeBudget({
      totalBudget: 700,
      expenses: [makeExpense({ date: "2026-07-01", amountBase: 40 })],
    })
    const status = budgetPaceStatus(budget, 7, "2026-07-01", "2026-07-01")
    expect(status).toBe("under_pace")
  })
})

// ── daysBetween ──────────────────────────────────────────────────────────────

describe("daysBetween", () => {
  it("returns 0 for same date", () => {
    expect(daysBetween("2026-07-15", "2026-07-15")).toBe(0)
  })

  it("returns positive for future date", () => {
    expect(daysBetween("2026-07-15", "2026-07-20")).toBe(5)
  })

  it("returns negative for past date", () => {
    expect(daysBetween("2026-07-20", "2026-07-15")).toBe(-5)
  })

  it("handles month boundary", () => {
    expect(daysBetween("2026-07-28", "2026-08-02")).toBe(5)
  })

  it("handles year boundary", () => {
    expect(daysBetween("2025-12-30", "2026-01-03")).toBe(4)
  })
})

// ── createExpense ────────────────────────────────────────────────────────────

describe("createExpense", () => {
  it("assigns a unique id", () => {
    const a = createExpense({ date: "2026-07-01", category: "Food", amount: 10, currency: "EUR", amountBase: 10, note: "" })
    const b = createExpense({ date: "2026-07-01", category: "Food", amount: 10, currency: "EUR", amountBase: 10, note: "" })
    expect(a.id).not.toBe(b.id)
  })

  it("preserves all input fields", () => {
    const exp = createExpense({ date: "2026-07-15", category: "Transport", amount: 25, currency: "JPY", amountBase: 0.17, note: "Train" })
    expect(exp.date).toBe("2026-07-15")
    expect(exp.category).toBe("Transport")
    expect(exp.amount).toBe(25)
    expect(exp.currency).toBe("JPY")
    expect(exp.amountBase).toBeCloseTo(0.17)
    expect(exp.note).toBe("Train")
  })

  it("id starts with 'expense-'", () => {
    const exp = createExpense({ date: "2026-07-01", category: "Food", amount: 10, currency: "EUR", amountBase: 10, note: "" })
    expect(exp.id.startsWith("expense-")).toBe(true)
  })
})

// ── expensesByDate ───────────────────────────────────────────────────────────

describe("expensesByDate", () => {
  it("returns empty object for empty expenses", () => {
    expect(expensesByDate([])).toEqual({})
  })

  it("groups expenses by date", () => {
    const expenses = [
      makeExpense({ date: "2026-07-01", amountBase: 20 }),
      makeExpense({ date: "2026-07-01", amountBase: 15 }),
      makeExpense({ date: "2026-07-02", amountBase: 30 }),
    ]
    const grouped = expensesByDate(expenses)
    expect(grouped["2026-07-01"]!.length).toBe(2)
    expect(grouped["2026-07-02"]!.length).toBe(1)
  })

  it("preserves expense data within groups", () => {
    const exp = makeExpense({ date: "2026-07-01", amountBase: 50, note: "Dinner" })
    const grouped = expensesByDate([exp])
    expect(grouped["2026-07-01"]![0]!.note).toBe("Dinner")
  })
})
