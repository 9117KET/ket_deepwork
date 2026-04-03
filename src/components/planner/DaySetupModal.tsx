/**
 * components/planner/DaySetupModal.tsx
 *
 * Prompted once per day when the user opens today's planner without having set
 * their schedule. User picks bedtime (last night), wake time, and sleep target
 * (tonight); actual sleep duration is shown as calculated info.
 * Times use a 24-hour clock to avoid AM/PM ambiguity.
 */

import { useState } from "react";

interface DaySetupModalProps {
  /** ISO date being set up (e.g. "2026-04-01"), used for display only. */
  date: string;
  initialBedTime?: string | null;
  initialWakeTime?: string | null;
  initialSleepTarget?: string | null;
  /** Yesterday's values — shown as a one-click "Same as yesterday" shortcut. */
  prevBedTime?: string | null;
  prevWakeTime?: string | null;
  prevSleepTarget?: string | null;
  onSave: (wakeTime: string, sleepTarget: string, bedTime: string) => void;
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


/**
 * Actual sleep duration in minutes between bedtime and wake time.
 * Handles crossing midnight (bed >= wake means bed was the night before).
 */
function sleepMinutes(bedTime: string, wakeTime: string): number {
  const [bh, bm] = bedTime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  const bedMin = (bh ?? 0) * 60 + (bm ?? 0);
  const wakeMin = (wh ?? 0) * 60 + (wm ?? 0);
  return wakeMin > bedMin ? wakeMin - bedMin : wakeMin + 1440 - bedMin;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Infer sleep duration in whole hours (clamped 4–12) from actual sleep minutes. */
function inferDurationHours(mins: number): number {
  return Math.max(4, Math.min(12, Math.round(mins / 60)));
}

/** Calculate bedtime given wake time and planned sleep duration in hours. */
function calcSleepTarget(wakeTime: string, sleepDurationHours: number): string {
  const [wh, wm] = wakeTime.split(":").map(Number);
  const totalMin = ((wh ?? 0) * 60 + (wm ?? 0) + (24 - sleepDurationHours) * 60) % 1440;
  return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
}

/** 24-hour time picker using two <select> elements (hours 0–23, minutes in 5-min steps). */
function TimePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const parts = value.split(":");
  const hour = parseInt(parts[0] ?? "0", 10);
  const minute = Math.round(parseInt(parts[1] ?? "0", 10) / 5) * 5 % 60;

  return (
    <div className="flex items-center gap-2">
      <select
        id={id}
        value={String(hour).padStart(2, "0")}
        onChange={(e) =>
          onChange(`${e.target.value}:${String(minute).padStart(2, "0")}`)
        }
        className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={String(i).padStart(2, "0")}>
            {String(i).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="text-base font-bold text-slate-400">:</span>
      <select
        aria-label="minutes"
        value={String(minute).padStart(2, "0")}
        onChange={(e) =>
          onChange(`${String(hour).padStart(2, "0")}:${e.target.value}`)
        }
        className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
      >
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
          <option key={m} value={String(m).padStart(2, "0")}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DaySetupModal({
  date,
  initialBedTime,
  initialWakeTime,
  initialSleepTarget,
  prevBedTime,
  prevWakeTime,
  prevSleepTarget,
  onSave,
  onSkip,
}: DaySetupModalProps) {
  const [bedTime, setBedTime] = useState(initialBedTime ?? "23:00");
  const [wakeTime, setWakeTime] = useState(initialWakeTime ?? "07:00");

  const initActualMins = sleepMinutes(initialBedTime ?? "23:00", initialWakeTime ?? "07:00");
  // If we have a saved sleep target, derive hours from it; otherwise default to actual sleep duration.
  const initTargetHours = initialSleepTarget && initialWakeTime
    ? inferDurationHours(sleepMinutes(initialSleepTarget, initialWakeTime))
    : inferDurationHours(initActualMins);
  const [targetDurationHours, setTargetDurationHours] = useState(initTargetHours);

  const actualSleepMins = sleepMinutes(bedTime, wakeTime);
  const actualSleepLabel = formatDuration(actualSleepMins);
  const calculatedSleepTarget = calcSleepTarget(wakeTime, targetDurationHours);

  const isValid =
    /^\d{2}:\d{2}$/.test(prevBedTime ?? "") &&
    /^\d{2}:\d{2}$/.test(prevWakeTime ?? "") &&
    /^\d{2}:\d{2}$/.test(prevSleepTarget ?? "");
  const hasPrev = !!prevBedTime && !!prevWakeTime && !!prevSleepTarget && isValid;
  const prevSleepLabel = hasPrev
    ? formatDuration(sleepMinutes(prevBedTime!, prevWakeTime!))
    : null;
  const prevTargetHours = hasPrev
    ? inferDurationHours(sleepMinutes(prevSleepTarget!, prevWakeTime!))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-slate-100">
          Set up your day
        </h2>
        <p className="mb-4 text-xs text-slate-400">{formatDateLabel(date)}</p>

        {hasPrev && (
          <button
            onClick={() => onSave(prevWakeTime!, prevSleepTarget!, prevBedTime!)}
            className="mb-4 w-full rounded border border-slate-600 px-4 py-2 text-left text-sm text-slate-300 hover:border-sky-500 hover:text-sky-400"
          >
            <span className="font-medium">Same as yesterday</span>
            <span className="ml-2 text-xs text-slate-500">
              Bed {prevBedTime} · wake {prevWakeTime} ({prevSleepLabel}) · target {prevTargetHours}h
            </span>
          </button>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="day-setup-bed"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Went to bed{" "}
              <span className="font-normal text-slate-500">(last night)</span>
            </label>
            <TimePicker id="day-setup-bed" value={bedTime} onChange={setBedTime} />
          </div>

          <div>
            <label
              htmlFor="day-setup-wake"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Woke up{" "}
              <span className="font-normal text-slate-500">(this morning)</span>
            </label>
            <TimePicker id="day-setup-wake" value={wakeTime} onChange={setWakeTime} />
          </div>

          <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
            <p className="text-xs text-slate-400">Actual sleep</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-emerald-400">
              {actualSleepLabel}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {bedTime} → {wakeTime}
            </p>
          </div>

          <div>
            <label
              htmlFor="day-setup-target"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Sleep target{" "}
              <span className="font-normal text-slate-500">(tonight)</span>
            </label>
            <select
              id="day-setup-target"
              value={targetDurationHours}
              onChange={(e) => setTargetDurationHours(Number(e.target.value))}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <option key={h} value={h}>{h} hours</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Bed at <span className="font-mono text-slate-300">{calculatedSleepTarget}</span>
              {" "}({24 - targetDurationHours}h awake)
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onSave(wakeTime, calculatedSleepTarget, bedTime)}
            className="flex-1 rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
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
