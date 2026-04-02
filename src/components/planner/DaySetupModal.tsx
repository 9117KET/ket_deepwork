/**
 * components/planner/DaySetupModal.tsx
 *
 * Prompted once per day when the user opens today's planner without having set
 * their schedule. User picks bedtime + sleep duration; wake time is calculated
 * automatically. Times use a 24-hour clock to avoid AM/PM ambiguity.
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

/** Add whole hours to a HH:MM time string, wrapping at midnight. */
function addHours(hhmm: string, hours: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const totalMin = ((h ?? 0) * 60 + (m ?? 0) + hours * 60) % 1440;
  return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
}

/** Infer sleep duration (whole hours, clamped 4–12) from bedtime + wake time. */
function inferDuration(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  const bedMin = (bh ?? 0) * 60 + (bm ?? 0);
  const wakeMin = (wh ?? 0) * 60 + (wm ?? 0);
  const mins = wakeMin > bedMin ? wakeMin - bedMin : wakeMin + 1440 - bedMin;
  return Math.max(4, Math.min(12, Math.round(mins / 60)));
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
  initialWakeTime,
  initialSleepTarget,
  prevWakeTime,
  prevSleepTarget,
  onSave,
  onSkip,
}: DaySetupModalProps) {
  const initBedtime = initialSleepTarget ?? "23:00";
  const initDuration =
    initialWakeTime && initialSleepTarget
      ? inferDuration(initialSleepTarget, initialWakeTime)
      : 7;

  const [bedtime, setBedtime] = useState(initBedtime);
  const [sleepDuration, setSleepDuration] = useState(initDuration);

  const calculatedWake = addHours(bedtime, sleepDuration);

  const hasPrev =
    !!prevWakeTime &&
    /^\d{2}:\d{2}$/.test(prevWakeTime) &&
    !!prevSleepTarget &&
    /^\d{2}:\d{2}$/.test(prevSleepTarget);
  const prevDuration = hasPrev ? inferDuration(prevSleepTarget!, prevWakeTime!) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-slate-100">
          Set up your day
        </h2>
        <p className="mb-4 text-xs text-slate-400">{formatDateLabel(date)}</p>

        {hasPrev && (
          <button
            onClick={() => onSave(prevWakeTime!, prevSleepTarget!)}
            className="mb-4 w-full rounded border border-slate-600 px-4 py-2 text-left text-sm text-slate-300 hover:border-sky-500 hover:text-sky-400"
          >
            <span className="font-medium">Same as yesterday</span>
            <span className="ml-2 text-xs text-slate-500">
              Bed {prevSleepTarget} · {prevDuration}h sleep → wake {prevWakeTime}
            </span>
          </button>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="day-setup-bed"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Bedtime{" "}
              <span className="font-normal text-slate-500">
                (when you go to sleep)
              </span>
            </label>
            <TimePicker id="day-setup-bed" value={bedtime} onChange={setBedtime} />
          </div>

          <div>
            <label
              htmlFor="day-setup-duration"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Sleep duration
            </label>
            <select
              id="day-setup-duration"
              value={sleepDuration}
              onChange={(e) => setSleepDuration(Number(e.target.value))}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </select>
          </div>

          <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-3">
            <p className="text-xs text-slate-400">Calculated wake-up time</p>
            <p className="mt-0.5 font-mono text-xl font-semibold text-sky-400">
              {calculatedWake}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Bed {bedtime} + {sleepDuration}h sleep
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onSave(calculatedWake, bedtime)}
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
