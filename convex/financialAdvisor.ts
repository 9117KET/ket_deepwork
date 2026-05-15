/**
 * convex/financialAdvisor.ts
 *
 * AI Financial Advisor - Convex action that calls Claude with full financial context.
 *
 * Approach: Context Injection (better than RAG for this use case)
 * - RAG is for large external document stores requiring retrieval
 * - For personal finance, ALL the user's data is relevant and small (<50KB)
 * - We inject the complete financial snapshot into every query
 * - This gives Claude full, accurate context - more reliable than vector search
 *
 * Requires ANTHROPIC_API_KEY in Convex Dashboard environment variables.
 */

import { action } from "./_generated/server"
import { v } from "convex/values"

declare const process: { env: Record<string, string | undefined> }

interface ConversationMessage {
  role: "user" | "assistant"
  content: string
}

interface FinancialSnapshot {
  income: number
  csp: Record<string, unknown>
  transactions: Record<string, unknown[]>
  savingsGoals: unknown[]
  debts: unknown[]
  fireSettings: Record<string, unknown>
  journalEntries: unknown[]
}

function buildSystemPrompt(snapshot: FinancialSnapshot): string {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTx = (snapshot.transactions?.[currentMonth] ?? []) as Array<{
    label: string; amount: number; bucket: string; date: string
  }>
  const totalSpentThisMonth = monthTx.reduce((s, t) => s + t.amount, 0)

  // Compute spending per bucket
  const bucketSpend: Record<string, number> = {}
  for (const tx of monthTx) {
    bucketSpend[tx.bucket] = (bucketSpend[tx.bucket] ?? 0) + tx.amount
  }

  // CSP budget per bucket
  const cspExpenses = (snapshot.csp as { expenses?: Array<{ bucket: string; monthlyAmount: number; label: string }> })?.expenses ?? []
  const bucketBudget: Record<string, number> = {}
  for (const e of cspExpenses) {
    bucketBudget[e.bucket] = (bucketBudget[e.bucket] ?? 0) + e.monthlyAmount
  }

  // Warnings
  const warnings: string[] = []
  for (const [bucket, spent] of Object.entries(bucketSpend)) {
    const budget = bucketBudget[bucket] ?? 0
    if (budget > 0 && spent > budget) {
      warnings.push(`${bucket} spending is over budget: €${spent.toFixed(0)} spent vs €${budget.toFixed(0)} budgeted (${Math.round((spent/budget)*100)}% of budget)`)
    }
  }

  const incomeDisplay = snapshot.income > 0 ? `€${snapshot.income.toLocaleString()}` : "not set"

  // Recent transactions list
  const recentTx = monthTx.slice(0, 20).map(t =>
    `  - ${t.date}: ${t.label} €${t.amount.toFixed(2)} [${t.bucket}]`
  ).join('\n')

  // Savings goals summary
  const goals = snapshot.savingsGoals as Array<{ label: string; currentAmount: number; targetAmount: number; monthlyContribution: number }>
  const goalsSummary = goals.map(g =>
    `  - ${g.label}: €${g.currentAmount} / €${g.targetAmount} (${Math.round((g.currentAmount/g.targetAmount)*100)}%) at €${g.monthlyContribution}/mo`
  ).join('\n')

  // Debts summary
  const debts = snapshot.debts as Array<{ label: string; balance: number; interestRate: number }>
  const debtsSummary = debts.map(d =>
    `  - ${d.label}: €${d.balance} at ${d.interestRate}% APR`
  ).join('\n')

  // FIRE progress
  const fire = snapshot.fireSettings as { currentPortfolioValue?: number; swrPct?: number; monthlyExpensesInRetirement?: number; currentAge?: number; targetRetirementAge?: number }
  const fireNumber = fire?.monthlyExpensesInRetirement && fire?.swrPct
    ? Math.round((fire.monthlyExpensesInRetirement * 12) / (fire.swrPct / 100))
    : null

  // Journal snippets
  const journalEntries = snapshot.journalEntries as Array<{ date: string; content: string }>
  const journalSnippets = journalEntries.slice(0, 3).map(e =>
    `  [${e.date}]: "${e.content.slice(0, 100)}..."`
  ).join('\n')

  return `You are a personal financial advisor with full access to this user's financial data. Be direct, specific, and use their actual numbers. Never give generic advice - always reference their specific situation.

## USER'S FINANCIAL SNAPSHOT

### Monthly Budget
- Net income: ${incomeDisplay}
- Total spent this month: €${totalSpentThisMonth.toFixed(0)}

### Budget vs Actual (this month)
${Object.entries(bucketBudget).map(([bucket, budget]) => {
  const actual = bucketSpend[bucket] ?? 0
  const over = actual > budget
  return `  - ${bucket}: €${actual.toFixed(0)} spent / €${budget.toFixed(0)} budget (${over ? 'OVER by €' + (actual - budget).toFixed(0) : 'under by €' + (budget - actual).toFixed(0)})`
}).join('\n') || '  - No budget set up yet (recommend setting up the Spending Plan)'}

### This Month's Expenses (most recent)
${recentTx || '  - No expenses logged yet'}

${warnings.length > 0 ? `### BUDGET WARNINGS\n${warnings.map(w => `  !! ${w}`).join('\n')}` : ''}

### Savings Goals
${goalsSummary || '  - No savings goals set yet'}

### Debts
${debtsSummary || '  - No debts recorded'}

### FIRE Status
${fireNumber ? `  - FIRE number: €${fireNumber.toLocaleString()}
  - Current portfolio: €${(fire.currentPortfolioValue ?? 0).toLocaleString()}
  - Progress: ${fireNumber > 0 ? Math.round(((fire.currentPortfolioValue ?? 0) / fireNumber) * 100) : 0}%
  - Age: ${fire.currentAge ?? 'not set'}, target retirement: ${fire.targetRetirementAge ?? 'not set'}` : '  - FIRE calculator not configured yet'}

### Recent Journal Entries
${journalSnippets || '  - No journal entries yet'}

## YOUR ROLE
- Give honest, direct advice using their actual numbers
- If they are overspending, say so clearly with the specific amounts
- Proactively note budget warnings even if not asked
- For Germany-specific advice: reference GKV, Freistellungsauftrag, Sparplan, etc. as relevant
- When recommending actions, be specific: "Move €50 from dining to your emergency fund" not "consider saving more"
- Keep responses concise (under 200 words unless a detailed breakdown is requested)
- Never make up numbers that aren't in the snapshot above`
}

export const chat = action({
  args: {
    message: v.string(),
    history: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
    snapshot: v.any(),
  },
  handler: async (_ctx, args): Promise<string> => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY not configured. Add it in Convex Dashboard > Project Settings > Environment Variables.",
      )
    }

    const systemPrompt = buildSystemPrompt(args.snapshot as FinancialSnapshot)

    const messages: ConversationMessage[] = [
      ...args.history.slice(-10), // Keep last 10 turns for context
      { role: "user", content: args.message },
    ]

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`Claude API error (${response.status}): ${body.slice(0, 200)}`)
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>
    }

    return data.content.find((c) => c.type === "text")?.text ?? "Sorry, I couldn't generate a response."
  },
})
