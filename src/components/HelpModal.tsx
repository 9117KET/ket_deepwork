/**
 * components/HelpModal.tsx
 *
 * Brief how-to for the planner: copy/fill, tasks, time, reorder, timer, and sidebar.
 */

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
  onStartTour?: () => void
}

const SECTIONS = [
  {
    title: 'Filling your day',
    items: [
      [
        'Fill from last [weekday]',
        "Replaces today with the same weekday last week (e.g. last Thursday → this Thursday). Use when you have a repeating weekly pattern. Click once; clicking again just overwrites.",
      ],
      [
        'Copy from yesterday',
        "Replaces today with yesterday's tasks (only shown when there's no last-same-weekday data). Good for the first week. Click once to avoid duplicates.",
      ],
    ],
  },
  {
    title: 'Tasks',
    items: [
      [
        'Sections',
        'Top to bottom: 3 Must-Do tasks (pinned, never overwritten by Fill), Morning routine, High Priority (protect for deep work), Medium / Low priority, Night routine.',
      ],
      [
        'Time & duration',
        'Set a start time so the app highlights the task when it\'s due (today only). Set duration (5 m → 8 h). Duration powers the shallow-time budget and the completion score.',
      ],
      [
        'Context menu (⋮ or right-click)',
        'Edit title, add task above/below, add subtask, mark as shallow or deep work, move to Not-Doing, abandon, or delete.',
      ],
      [
        'Shallow work warning',
        "Mark logistical tasks (emails, admin, errands) as shallow via the ⋮ menu. They show an amber badge. Once completed shallow tasks exceed 2 h in a day, a warning banner appears — a Cal Newport reminder to guard your deep work blocks.",
      ],
      [
        'Subtasks',
        "Add a subtask from any task's ⋮ menu. Completing the parent auto-completes all subtasks. Drag subtasks to reorder or move to another parent.",
      ],
      [
        'Not-Doing list',
        "Move tasks to Not-Doing from the ⋮ menu, or add global commitments you've decided to stop entirely (Peter Drucker: eliminate before you organise). Visible as a collapsible panel in the sidebar.",
      ],
    ],
  },
  {
    title: 'The ONE Thing (Gary Keller)',
    items: [
      [
        'North Star',
        "Your fixed life direction — a single sentence that guides every decision. Set it in the sidebar's North Star card. It doesn't change week to week; it's the compass everything else points toward.",
      ],
      [
        'Goal Cascade',
        "In the sidebar and Tracking dashboard: set goals at the 1-year, 6-month, and 3-month horizon. Each tier informs the next. Your 3-month goal appears as a daily reminder above the task sections.",
      ],
      [
        'ONE Thing per day / week / month',
        "The most important thing that makes everything else easier or unnecessary. Set it for the current day, week, and month in the sidebar. Ask: 'What is the ONE Thing I can do such that by doing it, everything else becomes easier or unnecessary?'",
      ],
    ],
  },
  {
    title: 'Deep Work (Cal Newport)',
    items: [
      [
        'Deep work timer',
        'In the sidebar: label a session, choose a preset (15–90 min) or type your own, and start. When the countdown ends the session is auto-saved to your day. Your total deep work time appears as a teal badge in the day header.',
      ],
      [
        'Weekly scoreboard',
        'In the Tracking dashboard: "Deep Work This Week" shows a progress bar against your weekly hour goal and per-day bars. Click the goal number to edit it.',
      ],
      [
        'Depth philosophy',
        'Rhythmic (fixed daily block — recommended), Journalistic (whenever gaps appear), or Bimodal (multi-day deep blocks). Rhythmic adds a teal banner above your High Priority block as a daily reminder.',
      ],
      [
        'Monthly review',
        'During the last 3 days of each month, an amber banner appears in the planner header. Click Open ↓ to scroll to the inline review card. Answer 8 questions covering deep work hours, your ONE Thing, habits, goal progress, and what to park. Once done, the card collapses to save space. Click Revisit ↓ to re-open it.',
      ],
    ],
  },
  {
    title: 'Habits & identity (Atomic Habits)',
    items: [
      [
        'Identity statement',
        '"I am X." Declare who you are becoming at the top of the habit checklist. Click to edit. James Clear\'s principle: behaviour follows identity, not the other way around.',
      ],
      [
        'Habit checklist',
        'In the sidebar: tap each habit to check it off for today. Each habit shows a 🔥 streak count. A habit highlighted in amber with ⚠ means you missed yesterday — the never-miss-twice alert. Act today to prevent the streak from becoming a new bad habit.',
      ],
      [
        'Editing habits',
        'Click "Edit" in the checklist header. Add habits (type + Enter), delete with ✕, reorder with ▲▼. Set an optional "After [anchor]" for habit stacking — e.g. "After waking up" — displayed under the habit name as a cue.',
      ],
      [
        'Monthly habit grid',
        'In the Tracking dashboard: a full-month table — ✓ = done, · = not done, final column = streak count. Spot consistency patterns at a glance.',
      ],
    ],
  },
  {
    title: 'Sidebar',
    items: [
      [
        'North Star & Goals',
        'Your life direction and cascading long-horizon goals (1-year → 6-month → 3-month). Set them once; they stay visible every day.',
      ],
      [
        'ONE Thing card',
        'Set the most important task for today, this week, and this month — the single thing that makes everything else easier or unnecessary.',
      ],
      [
        'Weekly overview',
        "This week's task completion bars (Mon–Sun) and today's overall percentage done.",
      ],
      [
        'Side Quests',
        'Optional bonus challenges that earn XP. A small set is selected each day from your defined quests. Complete them for a streak bonus alongside your main habits.',
      ],
      [
        'Focus reminder',
        'Rotating motivational quote that refreshes every 45 seconds.',
      ],
    ],
  },
  {
    title: 'Tracking dashboard',
    items: [
      [
        'Deep Work scoreboard',
        'Hours logged this week vs. your goal, plus a per-day bar chart. Click the goal number to edit it.',
      ],
      [
        'Block completion grid',
        'Month at a glance: columns = days, rows = sections. ✓ = 100%, X/Y = partial, red = 0%, · = no tasks. A "Day mode" row shows ⚪ Rest → 🌱 Starting → ⚡ In Progress → 🔥 Strong → 🏆 Elite.',
      ],
      [
        'Mood tracker',
        'Click any day in the mood row to log how you felt: 🙂 😐 🙁 😊 😢 😤 😴 🔥. Click again to change or clear.',
      ],
      [
        'Monthly review card',
        'At the bottom of the dashboard. Eight reflection questions: deep work hours, the ONE Thing, habit consistency, goal progress, focus hijackers, what to park, and what you avoided. Opens inline — no popup. Scroll directly to it from the amber end-of-month banner.',
      ],
      [
        'Chapter title',
        'Give each month a name ("The Foundation", "The Grind"). Shown at the top of the dashboard.',
      ],
    ],
  },
]

export function HelpModal({ isOpen, onClose, onStartTour }: HelpModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-share-bg/90 p-4 pt-12"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerHigh p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="help-title" className="text-lg font-semibold text-share-onBg">
            How to use the planner
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-share-onSurfaceVariant hover:bg-share-surfaceContainerHighest hover:text-share-onBg"
            aria-label="Close help"
          >
            X
          </button>
        </div>
        <div className="space-y-4 text-sm">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 font-medium text-sky-300">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map(([label, desc]) => (
                  <li key={label}>
                    <span className="font-medium text-share-onBg">{label}.</span>{' '}
                    <span className="text-share-onSurfaceVariant">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-share-onSurfaceVariant/60">
          Signed-in users sync everything to the cloud — tasks, habits, deep work sessions, goals,
          monthly reviews, and philosophy settings. Guest data lives in your browser only; sign in
          to keep it safe across devices.
        </p>
        {onStartTour && (
          <div className="mt-4 border-t border-share-outlineVariant/30 pt-4">
            <button
              type="button"
              onClick={onStartTour}
              className="w-full rounded-md border border-sky-500 bg-sky-500/10 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20"
            >
              Take the interactive tour
            </button>
            <p className="mt-1.5 text-center text-xs text-share-onSurfaceVariant/60">
              Highlights each area step by step (like onboarding).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
