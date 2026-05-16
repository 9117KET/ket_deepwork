import { useState, useRef, useEffect } from "react"
import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MaterialIcon } from "../ui/MaterialIcon"
import { getSuggestedPrompts, computeCurrentDay } from "../../domain/tripChat"
import type { ChatMessage } from "../../domain/tripChat"

interface Props {
  tripId: Id<"travelTrips">
  destination: string
  startDate?: string
  durationDays: number
}

export function TripChatAssistant({ tripId, destination, startDate, durationDays }: Props) {
  const chatAction = useAction(api.travel.chat)
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = new Date().toISOString().slice(0, 10)
  const currentDay = startDate ? computeCurrentDay(startDate, today) : null
  const inRange = currentDay !== null && currentDay >= 1 && currentDay <= durationDays
  const suggestedPrompts = getSuggestedPrompts(destination, inRange ? currentDay : null)

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history, open])

  async function handleSend(message: string) {
    if (!message.trim() || loading) return
    const userMsg: ChatMessage = { role: "user", content: message.trim() }
    const nextHistory = [...history, userMsg]
    setHistory(nextHistory)
    setInput("")
    setLoading(true)
    setError("")

    try {
      const reply = await chatAction({ tripId, history, message: message.trim() })
      setHistory([...nextHistory, { role: "assistant", content: reply }])
    } catch (err) {
      setError((err as Error).message ?? "Failed to get a response")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-2xl bg-share-primary px-4 py-3 text-sm font-bold text-share-onPrimary shadow-lg hover:opacity-90 transition-all md:bottom-8 md:right-8"
        title="Ask your travel assistant"
      >
        <MaterialIcon name={open ? "close" : "chat"} className="text-[1.1rem]" />
        <span className="hidden sm:inline">{open ? "Close" : "Ask AI"}</span>
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-40 right-4 z-40 flex flex-col w-80 md:w-96 max-h-[60vh] rounded-2xl border border-share-outlineVariant bg-share-surfaceContainer shadow-2xl md:bottom-20 md:right-8 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-share-outlineVariant bg-share-surfaceContainerLow shrink-0">
            <MaterialIcon name="travel_explore" className="text-share-primary text-[1.1rem]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-share-onBg">Trip Assistant</p>
              <p className="text-xs text-share-onSurfaceVariant truncate">{destination}</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {history.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-share-onSurfaceVariant text-center pb-1">
                  I know your itinerary. Ask me anything about your trip.
                </p>
                {suggestedPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void handleSend(prompt)}
                    className="w-full text-left rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow px-3 py-2 text-xs text-share-onBg hover:border-share-primary/40 hover:bg-share-surfaceContainerHigh transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {history.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={[
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-share-primary text-share-onPrimary rounded-br-sm"
                      : "bg-share-surfaceContainerHigh text-share-onBg rounded-bl-sm",
                  ].join(" ")}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-share-surfaceContainerHigh px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-share-onSurfaceVariant animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-share-onSurfaceVariant animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-share-onSurfaceVariant animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-share-error text-center">{error}</p>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-share-outlineVariant bg-share-surfaceContainerLow shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); void handleSend(input) }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your trip…"
                className="flex-1 rounded-xl border border-share-outlineVariant bg-share-surfaceContainer px-3 py-2 text-sm text-share-onBg placeholder:text-share-onSurfaceVariant/50 focus:border-share-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex items-center justify-center rounded-xl bg-share-primary p-2.5 text-share-onPrimary hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <MaterialIcon name="send" className="text-[1rem]" />
              </button>
            </form>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => { setHistory([]); setError("") }}
                className="mt-1 text-[10px] text-share-onSurfaceVariant/60 hover:text-share-onSurfaceVariant transition-colors"
              >
                Clear conversation
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
