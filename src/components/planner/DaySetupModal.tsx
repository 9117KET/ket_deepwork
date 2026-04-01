/**
 * components/planner/DaySetupModal.tsx
 *
 * Prompted once per day when the user opens today's planner without having set
 * their wake-up and bedtime. The two times drive computeBlocksFromWakeSleep(),
 * which replaces the fixed 5AM–11PM schedule with one anchored to the user's
 * actual day.
 */

import { useState } from "react";

interface DaySetupModalProps {
  /** ISO date being set up (e.g. "2026-04-01"), used for display only. */
  date: string;
  initialWakeTime?: string | null;
  initialSleepTarget?: string | null;
  /** Yesterday's wake time — shown as a one-click "Same as yesterday" shortcut. */
  prevWakeTime?: string | null;
  /** Yesterday's sleep target — paired with prevWakeTime for the shortcut. */
  prevSleepTarget?: string | null;
  onSave: (wakeTime: string, sleepTarget: string) => void;
  onSkip: () => void;
}

function formatDateLabel(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(year!, month! - 1, day!));
}

/** Returns an error string if the awake window is implausibly short, otherwise null. */
function getTimeError(wakeTime: string, sleepTarget: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(wakeTime) || !/^\d{2}:\d{2}$/.test(sleepTarget)) return null;
  const [wh, wm] = wakeTime.split(":").map(Number);
  const [sh, sm] = sleepTarget.split(":").map(Number);
  const wakeMin = (wh ?? 0) * 60 + (wm ?? 0);
  const rawSleep = (sh ?? 0) * 60 + (sm ?? 0);
  const sleepMin = rawSleep <= wakeMin ? rawSleep + 1440 : rawSleep;
  const awakeHours = Math.round((sleepMin - wakeMin) / 60);
  if (awakeHours < 6) {
    return `Only ${awakeHours}h awake — for midnight use 00:00, not 12:00.`;
  }
  return null;
}

/** Format "HH:MM" to a human-readable label like "8:30 AM". */
function formatHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h ?? 0;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const mins = (m ?? 0) === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${hour12}${mins} ${period}`;
}

export function DaySetupModal({
  date,
  initialWakeTime,
  initialSleepTarget,
  prevWakeTime,
  prevSleepTarget,
  onSave,
  onSkip,
}: DaySetupModalProps) {
  const [wakeTime, setWakeTime] = useState(initialWakeTime ?? "06:30");
  const [sleepTarget, setSleepTarget] = useState(initialSleepTarget ?? "23:00");

  const bothFilled =
    /^\d{2}:\d{2}$/.test(wakeTime) && /^\d{2}:\d{2}$/.test(sleepTarget);
  const timeError = bothFilled ? getTimeError(wakeTime, sleepTarget) : null;
  const canSave = bothFilled && !timeError;

  const hasPrevSchedule =
    prevWakeTime && /^\d{2}:\d{2}$/.test(prevWakeTime) &&
    prevSleepTarget && /^\d{2}:\d{2}$/.test(prevSleepTarget) &&
    !getTimeError(prevWakeTime, prevSleepTarget);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-slate-100">
          Set up your day
        </h2>
        <p className="mb-4 text-xs text-slate-400">{formatDateLabel(date)}</p>

        {hasPrevSchedule && (
          <button
            onClick={() => onSave(prevWakeTime!, prevSleepTarget!)}
            className="mb-4 w-full rounded border border-slate-600 px-4 py-2 text-left text-sm text-slate-300 hover:border-sky-500 hover:text-sky-400"
          >
            <span className="font-medium">Same as yesterday</span>
            <span className="ml-2 text-xs text-slate-500">
              {formatHHMM(prevWakeTime!)} wake · {formatHHMM(prevSleepTarget!)} bed
            </span>
          </button>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="day-setup-wake"
              className="mb-1 block text-sm font-medium text-slate-300"
            >
              Wake-up time
            </label>
            <input
              id="day-setup-wake"
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="day-setup-sleep"
              className="mb-1 block text-sm font-medium text-slate-300"
            >
              Bedtime
            </label>
            <input
              id="day-setup-sleep"
              type="time"
              value={sleepTarget}
              onChange={(e) => setSleepTarget(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Midnight = 00:00 &nbsp;·&nbsp; 11 PM = 23:00
            </p>
          </div>
        </div>

        {timeError && (
          <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            {timeError}
          </p>
        )}

        {!timeError && (
          <p className="mt-3 text-xs text-slate-500">
            Your time blocks will be arranged around these times.
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onSave(wakeTime, sleepTarget)}
            disabled={!canSave}
            className="flex-1 rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={onSkip}
            className="flex-1 rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-300"
          >
            Skip for today
          </button>
        </div>
      </div>
    </div>
  );
}
