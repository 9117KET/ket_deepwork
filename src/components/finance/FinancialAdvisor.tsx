/**
 * components/finance/FinancialAdvisor.tsx
 *
 * AI-powered financial chat assistant with full context injection.
 *
 * Architecture: Context Injection (not RAG)
 * - RAG retrieves relevant chunks from large document stores using vector search
 * - For personal finance, ALL the user's data fits in one context window (<50KB)
 * - We inject the complete financial snapshot with every query
 * - This gives more accurate, consistent answers than vector retrieval
 * - Upgrade path: add vector search for journal if entries grow very large
 *
 * The advisor:
 * - Knows your income, budget, transactions, debts, goals, FIRE status
 * - Warns proactively about budget overruns
 * - Responds to natural language questions about your finances
 * - Voice input supported for hands-free querying
 */

import { useRef, useState } from 'react'
import { useAction, useConvexAuth } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { MaterialIcon } from '../ui/MaterialIcon'
import { AudioInput } from '../ui/AudioInput'
import type { FinancialState, AdvisorMessage, CSPBucket } from '../../domain/financialTypes'
import { CSP_TARGETS } from '../../domain/financialTypes'

const QUICK_PROMPTS = [
  'How am I doing financially this month?',
  'Am I on track with my savings goals?',
  'Which budget category should I cut first?',
  'How much can I safely spend on guilt-free things this month?',
  'What should I prioritize: paying off debt or investing?',
  'Am I on track for financial independence?',
]

function buildSnapshot(state: FinancialState) {
  const currentMonth = new Date().toISOString().slice(0, 7)
  return {
    income: state.csp?.monthlyNetIncome ?? 0,
    csp: state.csp ?? {},
    transactions: state.transactions ?? {},
    savingsGoals: state.savingsGoals ?? [],
    debts: state.debts ?? [],
    fireSettings: state.fireSettings ?? {},
    journalEntries: (state.journalEntries ?? []).slice(0, 10),
    accounts: state.accounts ?? [],
    portfolio: state.portfolio ?? [],
    currentMonth,
  }
}

/** Compute proactive budget warnings from current month's transactions. */
function computeWarnings(state: FinancialState): Array<{ bucket: CSPBucket; overspend: number; budget: number; actual: number }> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTx = state.transactions?.[currentMonth] ?? []
  const cspExpenses = state.csp?.expenses ?? []

  const bucketBudget: Record<CSPBucket, number> = { fixed: 0, investment: 0, savings: 0, guiltFree: 0 }
  for (const e of cspExpenses) {
    bucketBudget[e.bucket] = (bucketBudget[e.bucket] ?? 0) + e.monthlyAmount
  }

  const bucketActual: Record<CSPBucket, number> = { fixed: 0, investment: 0, savings: 0, guiltFree: 0 }
  for (const tx of monthTx) {
    bucketActual[tx.bucket as CSPBucket] = (bucketActual[tx.bucket as CSPBucket] ?? 0) + (tx as { amount: number }).amount
  }

  return (Object.keys(CSP_TARGETS) as CSPBucket[])
    .filter((b) => bucketBudget[b] > 0 && bucketActual[b] > bucketBudget[b])
    .map((b) => ({
      bucket: b,
      overspend: bucketActual[b] - bucketBudget[b],
      budget: bucketBudget[b],
      actual: bucketActual[b],
    }))
}

interface FinancialAdvisorProps {
  state: FinancialState
  onSaveHistory: (history: AdvisorMessage[]) => void
}

export function FinancialAdvisor({ state, onSaveHistory }: FinancialAdvisorProps) {
  const { isAuthenticated } = useConvexAuth()
  const chatAction = useAction(api.financialAdvisor.chat)
  const [history, setHistory] = useState<AdvisorMessage[]>(state.advisorHistory ?? [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const warnings = computeWarnings(state)

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return
    const userMsg: AdvisorMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setInput('')
    setLoading(true)
    setError('')

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const snapshot = buildSnapshot(state)
      const response = await chatAction({
        message: content.trim(),
        history: history.map((m) => ({ role: m.role, content: m.content })),
        snapshot,
      })
      const assistantMsg: AdvisorMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      }
      const finalHistory = [...newHistory, assistantMsg]
      setHistory(finalHistory)
      onSaveHistory(finalHistory)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg.includes('ANTHROPIC_API_KEY')
        ? 'ANTHROPIC_API_KEY not set in Convex env vars. See Convex Dashboard > Project Settings > Environment Variables.'
        : msg)
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = () => {
    setHistory([])
    onSaveHistory([])
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-8 text-center space-y-3">
        <MaterialIcon name="lock" className="text-share-onSurfaceVariant/40 text-[2rem]" />
        <p className="text-xs text-share-onSurfaceVariant max-w-xs mx-auto">
          Sign in to access the AI financial advisor. Your financial data is sent securely to Claude on Convex servers.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon name="psychology" filled className="text-share-primary text-[1.5rem] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-share-onBg">Financial Advisor</h2>
            <p className="text-xs text-share-onSurfaceVariant mt-1 leading-relaxed">
              An AI advisor with full access to your financial data - budget, expenses, goals, debts, and FIRE progress. Ask anything. It uses your actual numbers, not generic advice.
            </p>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="text-[10px] text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant transition-colors flex-shrink-0"
            >
              Clear chat
            </button>
          )}
        </div>
      </section>

      {/* Proactive warnings */}
      {warnings.length > 0 && (
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <MaterialIcon name="warning" filled className="text-red-400 text-[1rem]" />
            <p className="text-xs font-semibold text-red-400">Budget alerts</p>
          </div>
          {warnings.map((w) => (
            <div key={w.bucket} className="flex items-center justify-between text-xs">
              <span className="text-share-onSurfaceVariant">
                {CSP_TARGETS[w.bucket].label} over budget
              </span>
              <span className="text-red-400 font-medium">
                +€{w.overspend.toFixed(0)} (€{w.actual.toFixed(0)} / €{w.budget.toFixed(0)})
              </span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => sendMessage("I'm over budget this month. What should I do?")}
            className="text-[10px] text-share-primary hover:underline"
          >
            Ask the advisor what to do
          </button>
        </section>
      )}

      {/* Chat window */}
      <section className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow overflow-hidden">
        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {history.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <MaterialIcon name="chat" className="text-share-onSurfaceVariant/20 text-[2rem]" />
              <p className="text-xs text-share-onSurfaceVariant/50 max-w-xs">
                Ask about your budget, spending, savings goals, or financial independence progress. The advisor has your full financial picture.
              </p>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="h-6 w-6 rounded-full bg-share-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MaterialIcon name="psychology" className="text-share-primary text-[0.85rem]" />
                </div>
              )}
              <div className={[
                'max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-share-primary text-share-onPrimary rounded-tr-sm'
                  : 'bg-share-surfaceContainerHigh text-share-onBg rounded-tl-sm',
              ].join(' ')}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="h-6 w-6 rounded-full bg-share-surfaceContainerHigh flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MaterialIcon name="person" className="text-share-onSurfaceVariant text-[0.85rem]" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5 justify-start">
              <div className="h-6 w-6 rounded-full bg-share-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MaterialIcon name="psychology" className="text-share-primary text-[0.85rem]" />
              </div>
              <div className="bg-share-surfaceContainerHigh rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-share-onSurfaceVariant/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-share-onSurfaceVariant/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-share-onSurfaceVariant/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-share-outlineVariant p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage(input)
                }
              }}
              placeholder="Ask about your finances..."
              disabled={loading}
              className="flex-1 rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/40 focus:border-share-primary focus:outline-none disabled:opacity-50"
            />
            <AudioInput
              onTranscript={(text) => { setInput(text); void sendMessage(text) }}
              lang="en-US"
            />
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={!input.trim() || loading}
              className="rounded-lg border border-share-primary bg-share-primary/10 p-2 text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <MaterialIcon name="send" className="text-[1rem]" />
            </button>
          </div>

          {/* Quick prompts */}
          {history.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={loading}
                  className="rounded-full border border-share-outlineVariant bg-share-surfaceContainer px-2.5 py-1 text-[10px] text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works note */}
      <div className="rounded-xl border border-share-outlineVariant/40 bg-share-surfaceContainerLow/50 p-4">
        <p className="text-[10px] text-share-onSurfaceVariant/60 leading-relaxed">
          <span className="font-medium text-share-onBg">How it works: </span>
          The advisor uses context injection rather than RAG - your complete financial snapshot (budget, transactions, goals, journal) is included with every query. This gives accurate, personalized answers for your data volume. Your data is processed server-side via Convex and never stored by the AI provider.
        </p>
      </div>
    </div>
  )
}
