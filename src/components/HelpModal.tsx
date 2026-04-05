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
        "Replaces today with the same weekday last week (e.g. last Thursday this Thursday). Use when you have a repeating weekly pattern. Click once; clicking again just overwrites.",
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
        'Top to bottom: 3 must-dos, Morning routine, High / Medium / Low priority, Night routine. Add tasks in each section using the Add task input at the bottom of a section.',
      ],
      [
        'Time & duration',
        'Set a start time (clock icon) so the app can remind you. Set duration (dropdown in minutes: 5, 10, 15 up to 120). Both are optional.',
      ],
      [
        'Due-now reminder',
        "When the current time matches a task's start time (today only), that task is highlighted and a short beep plays. Checked every ~15 seconds.",
      ],
      [
        'Links',
        "If a task's title is a full URL (e.g. https://...), it's shown as a clickable link that opens in a new tab.",
      ],
      [
        'Reorder',
        'Use the six-dot grip on the left of a task to drag it up or down within the same section.',
      ],
      [
        'Delete',
        'Use the X button on the right of a task to remove it.',
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
        'Deep work timer',
        'Set a focus block (e.g. 25, 45, 60 min), add a label, and start. Use for focused work sessions.',
      ],
      [
        'Focus reminder',
        'Rotating motivational line that updates every 45 seconds.',
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
          Signed-in users sync data to the cloud automatically. Guest data lives in your browser
          only - sign in to keep it safe across devices. Use Copy from yesterday or Fill from last
          [weekday] once per day to avoid duplicate tasks.
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
