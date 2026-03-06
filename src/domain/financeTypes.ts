/**
 * domain/financeTypes.ts
 *
 * Core domain types for the Financial Planner.
 * All amounts are stored in cents to avoid float rounding issues.
 */

/** Month identifier: YYYY-MM (e.g. "2026-03"). */
export type MonthId = string;

/** Income source for categorising entries. */
export type IncomeSourceId =
  | "savingsFromLastMonth"
  | "personalJob"
  | "businessEducationFamily"
  | "other";

export interface IncomeEntry {
  id: string;
  source: IncomeSourceId;
  /** Custom label when source is "other". */
  label?: string;
  amountCents: number;
  /** ISO date YYYY-MM-DD. */
  date: string;
}

export interface MonthData {
  monthId: MonthId;
  income: IncomeEntry[];
  savingsAllocationCents: number;
  emergencyAllocationCents: number;
  /** Recurring monthly bills for this month (name + amount). */
  bills: BillLineItem[];
  /** Variable/daily expenses. */
  variableExpenses: VariableExpense[];
}

export interface BillLineItem {
  id: string;
  name: string;
  amountCents: number;
}

/** Global template: default bill names and amounts, used to prefill new months. */
export interface BillsTemplate {
  items: BillLineItem[];
}

export interface VariableExpense {
  id: string;
  label: string;
  amountCents: number;
  /** ISO date YYYY-MM-DD. */
  date: string;
}

export interface FinanceState {
  /** Data keyed by month id (YYYY-MM). */
  months: Record<MonthId, MonthData | undefined>;
  /** Default recurring bills; edit once, apply to any month. */
  billsTemplate: BillsTemplate;
}

/** Human-readable labels for income sources. */
export const INCOME_SOURCE_LABELS: Record<IncomeSourceId, string> = {
  savingsFromLastMonth: "Savings from last month",
  personalJob: "Personal job",
  businessEducationFamily: "Business / education / family",
  other: "Other",
};

export const EMPTY_FINANCE_STATE: FinanceState = {
  months: {},
  billsTemplate: { items: [] },
};

/** Generate a unique id for entries (income, bills, expenses). */
export function createFinanceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
