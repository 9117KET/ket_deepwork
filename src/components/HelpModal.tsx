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
        'Top to bottom: 3 Must-Do tasks, Morning routine, High Priority (Focus), Medium / Low priority, Night routine. Add tasks in each section using the Add task input at the bottom.',
      ],
      [
        'Time & duration',
        'Set a start time so the app can remind you when a task is due. Set duration (5 m → 8 h). Both are optional but duration powers the shallow-time budget and the completion score.',
      ],
      [
        'Context menu (⋮ or right-click grip)',
        'Edit title, add task above/below, add subtask, mark as shallow or deep, move to Not Doing, abandon, or delete.',
      ],
      [
        'Mark as shallow',
        "Shallow work = logistical tasks that don't require deep focus (emails, admin, errands). Mark them via the ⋮ menu. Shallow tasks show an amber badge. Once completed shallow tasks total 2 h in a day, a warning banner appears above your sections — a reminder from Cal Newport's framework to protect your deep blocks.",
      ],
      [
        'Subtasks',
        "Add a subtask from a task's ⋮ menu. Completing the parent automatically completes all subtasks.",
      ],
      [
        'Due-now reminder',
        "When the current time matches a task's scheduled time (today only), that task is highlighted and a short beep plays.",
      ],
      [
        'Reorder',
        'Drag the six-dot grip to reorder within a section. On mobile, use the ↑↓ arrows.',
      ],
    ],
  },
  {
    title: 'Deep Work (Cal Newport)',
    items: [
      [
        'Deep work timer',
        'In the sidebar: choose a preset (15 – 60 min) or type your own, add a label, and start. When the countdown ends the session is automatically saved to your day. Your total deep work time appears as a teal badge in the day header.',
      ],
      [
        'Weekly scoreboard',
        'In the Tracking dashboard: the "Deep Work This Week" card shows a progress bar against your weekly hour goal and per-day bars for Mon–Sun. Click the goal number to edit it — it syncs to your account.',
      ],
      [
        'Depth philosophy',
        'Also in the Tracking dashboard. Choose Rhythmic (fixed daily deep block — recommended), Journalistic (drop in whenever a gap appears), or Bimodal (multi-day deep blocks). When Rhythmic is selected, a teal banner shows your High Priority block window in the planner as a reminder to protect it.',
      ],
    ],
  },
  {
    title: 'Habits & identity (Atomic Habits)',
    items: [
      [
        'Identity statement',
        '"I am X." Declare who you are becoming — e.g. "I am someone who does deep work every day." Click it to edit. Shown at the top of the habit checklist as a daily anchor. James Clear\'s principle: identity precedes behavior.',
      ],
      [
        'Habit checklist',
        'In the sidebar: tap each habit to check it off for today. Each habit shows a 🔥 streak count (consecutive days completed). A habit highlighted in amber with ⚠ means you missed yesterday but completed the day before — the never-miss-twice alert. Completing it today breaks the risk.',
      ],
      [
        'Never-miss-twice rule',
        'Missing a habit once is an accident. Missing twice is the start of a new (bad) habit. The app watches for this pattern and flags the habit in amber so you can act today.',
      ],
      [
        'Editing habits',
        'Click "Edit" in the habit checklist header to open the habit editor. Add new habits (type name + Enter or click Add), delete with ✕, reorder with ▲▼. Each habit has an optional "After…" stack anchor — e.g. "After waking up" — shown as a trigger phrase below the habit name.',
      ],
      [
        'Habit stacking',
        '"After [anchor], I will [habit]." Set the anchor in the habit editor. Anchors appear under the habit name in the checklist as a cue. James Clear: stack new habits onto existing ones for automatic triggering.',
      ],
      [
        'Monthly habit grid',
        'In the Tracking dashboard: a full-month table shows ✓ or · for each habit on each day, with the current streak in the final column. Useful for spotting patterns and motivating consistency.',
      ],
    ],
  },
  {
    title: 'Sidebar (right)',
    items: [
      [
        'Weekly overview',
        "Shows this week's task completion (bars per day) and today's percentage done.",
      ],
      [
        'Not-Doing list',
        "Commitments you've consciously chosen not to pursue. Add globally (persists across days) or per day. Reduces decision fatigue by making your boundaries visible.",
      ],
      [
        'Focus reminder',
        'Rotating motivational quote that updates every 45 seconds.',
      ],
    ],
  },
  {
    title: 'Tracking dashboard',
    items: [
      [
        'Deep Work scoreboard',
        'At the top: a progress bar showing hours of deep work logged this week vs. your goal. Click the goal number to edit it. Per-day bars show Mon–Sun at a glance.',
      ],
      [
        'Block completion grid',
        'A month-at-a-glance view: each column is a day, each row is a section (Must Do, Morning, High, Medium, Low, Night). Green ✓ = all done, amber X/Y = partial, red = none done, · = no tasks.',
      ],
      [
        'Day mode badges',
        'Each day column shows an auto-computed badge — ⚪ Rest, 🌱 Starting, ⚡ In Progress, 🔥 Strong, 🏆 Elite — based on duration-weighted completion %.',
      ],
      [
        'Mood tracker',
        'Click a day in the mood row to log how you felt. Eight options: 🙂 😐 🙁 😊 😢 😤 😴 🔥. Click again to change or clear.',
      ],
      [
        'Habit tracking grid',
        'Below the block grid: the full-month habit table. Each row is a habit, each column a day. ✓ = done, · = not done. The final column shows the current streak. Habits are the same ones in your sidebar checklist.',
      ],
      [
        'Chapter title',
        'Give each month a name ("The Foundation", "The Grind", "The Pivot"). Edit the input at the top of the dashboard.',
      ],
    ],
  },
]

export function HelpModal({ isOpen, onClose, onStartTour }: HelpModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 pt-12"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="help-title" className="text-lg font-semibold text-slate-100">
            How to use the planner
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
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
                    <span className="font-medium text-slate-200">{label}.</span>{' '}
                    <span className="text-slate-400">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Signed-in users sync data to the cloud automatically — habits, deep work sessions,
          philosophy settings, and tasks all included. Guest data lives in your browser only; sign
          in to keep it safe across devices. Use Copy from yesterday or Fill from last [weekday]
          once per day to avoid duplicate tasks.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Need help?{' '}
          <a href="/support" className="text-sky-400 underline hover:text-sky-300">
            Visit the Support page
          </a>
          .
        </p>
        {onStartTour && (
          <div className="mt-4 border-t border-slate-700 pt-4">
            <button
              type="button"
              onClick={onStartTour}
              className="w-full rounded-md border border-sky-500 bg-sky-500/10 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/20"
            >
              Take the interactive tour
            </button>
            <p className="mt-1.5 text-center text-xs text-slate-500">
              Highlights each area step by step (like onboarding).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
