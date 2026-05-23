/**
 * hooks/useTimeAwareness.ts
 *
 * Tick-driven time awareness: due-now tasks, active section blocks, sleep
 * detection, timeframe labels, and the beep notification system.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIXED_SECTIONS,
  type AppState,
  type TaskSectionId,
} from "../domain/types";
import { todayIso, normalizeHhmm } from "../domain/dateUtils";
import {
  getActiveSectionIds,
  getSectionTimeframeLabel,
  isSleepTime,
  type DayBlocks,
} from "../domain/sectionTimeBlocks";
import { getOrCreateDay } from "../storage/localStorageState";

export function useTimeAwareness(
  appState: AppState,
  timeOffsetMinutes: number,
  computedBlocks: DayBlocks | undefined,
) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const taskIdsDueNow = useMemo(() => {
    void tick; // re-run when tick updates (every 15s) so due-now matches current time
    const today = todayIso();
    const day = getOrCreateDay(appState, today);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const set = new Set<string>();

    // 1) Highlight all tasks currently in their time window
    for (const task of day.tasks) {
      if (!task.scheduledAt || task.isDone) continue;
      const normalized = normalizeHhmm(task.scheduledAt);
      const [h, m] = normalized.split(":").map(Number);
      const startMinutes = h * 60 + m;
      const durationMins = task.durationMinutes ?? 1;
      const endMinutes = startMinutes + durationMins;
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes)
        set.add(task.id);
    }

    // 2) If no task is in-window, highlight the next upcoming one so completing a task
    //    immediately shows the next (rewarding flow)
    if (set.size === 0) {
      let nextStart = Infinity;
      let nextId: string | null = null;
      for (const task of day.tasks) {
        if (!task.scheduledAt || task.isDone) continue;
        const normalized = normalizeHhmm(task.scheduledAt);
        const [h, m] = normalized.split(":").map(Number);
        const startMinutes = h * 60 + m;
        if (startMinutes >= currentMinutes && startMinutes < nextStart) {
          nextStart = startMinutes;
          nextId = task.id;
        }
      }
      if (nextId) set.add(nextId);
    }

    return set;
  }, [appState, tick]);

  /** Which section block is active right now (5-9 morning, 9-5 focus, etc.). Updates with tick. */
  const activeSectionIds = useMemo(() => {
    void tick;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return getActiveSectionIds(currentMinutes, timeOffsetMinutes, computedBlocks);
  }, [tick, timeOffsetMinutes, computedBlocks]);

  const isSleepTimeNow = useMemo(() => {
    void tick;
    const now = new Date();
    return isSleepTime(now.getHours() * 60 + now.getMinutes(), timeOffsetMinutes, computedBlocks);
  }, [tick, timeOffsetMinutes, computedBlocks]);

  const timeframeLabelsBySection: Record<TaskSectionId, string | null> = useMemo(() => {
    const labels: Record<TaskSectionId, string | null> = {
      mustDo: null,
      morningRoutine: null,
      highPriority: null,
      mediumPriority: null,
      lowPriority: null,
      nightRoutine: null,
      sideQuest: null,
    };
    for (const section of FIXED_SECTIONS) {
      labels[section.id] = getSectionTimeframeLabel(section.id, timeOffsetMinutes, computedBlocks);
    }
    return labels;
  }, [timeOffsetMinutes, computedBlocks]);

  const lastBeepedRef = useRef<
    Record<string, { start?: boolean; mid?: boolean; end?: boolean }>
  >({});
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
      }
      const ctx = audioCtxRef.current;
      void ctx.resume().then(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void tick;
    const today = todayIso();
    const day = getOrCreateDay(appState, today);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const task of day.tasks) {
      if (!task.scheduledAt || task.isDone) continue;
      const normalized = normalizeHhmm(task.scheduledAt);
      const [h, m] = normalized.split(":").map(Number);
      const startMinutes = h * 60 + m;
      const durationMins = task.durationMinutes ?? 1;
      const midMinutes = startMinutes + Math.floor(durationMins / 2);
      const endMinutes = startMinutes + durationMins;

      const key = `${task.id}-${today}`;
      const state = lastBeepedRef.current[key] ?? {};

      if (currentMinutes >= endMinutes && !state.end) {
        lastBeepedRef.current[key] = { ...state, end: true };
        playBeep();
        return;
      }
      if (currentMinutes >= midMinutes && !state.mid) {
        lastBeepedRef.current[key] = { ...state, mid: true };
        playBeep();
        return;
      }
      if (currentMinutes >= startMinutes && !state.start) {
        lastBeepedRef.current[key] = { ...state, start: true };
        playBeep();
        return;
      }
    }
  }, [appState, tick, playBeep]);

  return { tick, taskIdsDueNow, activeSectionIds, isSleepTimeNow, timeframeLabelsBySection };
}
