/**
 * components/timer/MotivationCard.tsx
 *
 * Rotating motivational sentences that sit next to the deep work timer.
 * Keeps a gentle reminder of long-term goals in view during focus blocks.
 */

import { useEffect, useMemo, useState } from 'react'

const QUOTES: string[] = [
  'One deep, honest block today is better than ten distracted hours.',
  'Future you is watching. Make them proud with this session.',
  'Small, focused steps every day build unreasonable outcomes.',
  'Protect this hour like a meeting with your future family.',
  'Deep work now, freedom later. Stay with the hard thing.',
  'The next 45 minutes can move the needle more than the last week.',
  'You don’t need more time, you need more focus. You already have it.',
  'Job offers follow people who keep quiet promises to themselves.',
  'This session is a gift to your future career.',
  'Most people stop when it gets boring. You keep going.',
  'When you feel like quitting, do five more deliberate minutes.',
  'You’re not behind; you’re in training. Train well this block.',
  'Every keystroke here is making the next opportunity more likely.',
  'Deep focus is rare. That makes your work here valuable.',
  'Distraction steals from the people you care about. Protect this time.',
  'Today’s discipline is tomorrow’s peace of mind.',
  'Treat this timer as a contract with your future self.',
  'You can be tired and still give this block your best.',
  'Stay with the plan. Adjust later, not mid-session.',
  'You are building a body of work, one focused block at a time.',
]

interface MotivationCardProps {
  rotationSeconds?: number
}

export function MotivationCard({ rotationSeconds = 45 }: MotivationCardProps) {
  const [index, setIndex] = useState(0)

  const safeRotationMs = useMemo(
    () => Math.max(10, rotationSeconds) * 1000,
    [rotationSeconds],
  )

  useEffect(() => {
    if (QUOTES.length <= 1) return

    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % QUOTES.length)
    }, safeRotationMs)

    return () => window.clearInterval(intervalId)
  }, [safeRotationMs])

  const quote = QUOTES[index] ?? QUOTES[0]

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <header className="mb-2">
        <h3 className="text-sm sm:text-base font-semibold text-slate-100">
          Focus reminder
        </h3>
        <p className="text-xs text-slate-400">
          Gentle motivation for this deep work season.
        </p>
      </header>
      <p className="text-sm leading-relaxed text-slate-200">{quote}</p>
    </section>
  )
}

