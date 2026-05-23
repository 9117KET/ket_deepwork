/**
 * hooks/useDayBlockEditor.ts
 *
 * State machine for the day schedule / block duration editor.
 * Handles the DaySetupModal, sleep-warning confirmation, conflict resolution,
 * and the scope modal (today-only vs. all-days-default).
 */

import { useCallback, useMemo, useState } from "react";
import {
  FIXED_SECTIONS,
  type AppState,
  type BlockDurations,
  type DayState,
  type Task,
  type TaskSectionId,
} from "../domain/types";
import { todayIso } from "../domain/dateUtils";
import {
  BLOCK_ORDER,
  applyBlockDurationChange,
  blockDurationsToRatios,
  computeAwakeMinutes,
  computeBlocksFromDurations,
  getDefaultBlockDurations,
  ratiosToBlockDurations,
} from "../domain/sectionTimeBlocks";
import { getOrCreateDay } from "../storage/localStorageState";

export interface ConflictPending {
  durations: BlockDurations;
  newSleepTarget: string | null;
  blockName: string;
  newBlockStart: string;
  newBlockEnd: string;
  tasks: Task[];
  nextSectionId: TaskSectionId | null;
  nextBlockName: string | null;
}

export interface DurationScopePending {
  durations: BlockDurations;
  newSleepTarget: string | null;
  afterApply?: (next: AppState) => AppState;
}

export function useDayBlockEditor(
  dayState: DayState,
  blockDurationRatios: AppState['blockDurationRatios'],
  selectedDay: string,
  updateAppState: (updater: (prev: AppState) => AppState) => void,
  shareMode: 'view' | 'edit' | undefined,
) {
  // Resolved block minutes: per-day override > global ratio template > wake/sleep defaults.
  const effectiveBlockDurations = useMemo<BlockDurations | null>(() => {
    if (!dayState.wakeTime || !dayState.sleepTarget) return null;
    if (dayState.blockDurations) return dayState.blockDurations;
    const ratios = blockDurationRatios;
    if (ratios) {
      const awake = computeAwakeMinutes(dayState.wakeTime, dayState.sleepTarget);
      return ratiosToBlockDurations(ratios, awake);
    }
    return getDefaultBlockDurations(dayState.wakeTime, dayState.sleepTarget);
  }, [dayState, blockDurationRatios]);

  // Per-day timeline blocks derived from effective durations.
  const computedBlocks = useMemo(() => {
    if (!dayState.wakeTime || !dayState.sleepTarget || !effectiveBlockDurations) return undefined;
    return computeBlocksFromDurations(dayState.wakeTime, effectiveBlockDurations);
  }, [dayState.wakeTime, dayState.sleepTarget, effectiveBlockDurations]);

  // Modal state: auto-open when today has no wake time; "Edit schedule" forces it open.
  const [daySetupOpen, setDaySetupOpen] = useState(false);
  // Track which day the user explicitly skipped so we don't re-prompt automatically.
  const [daySetupSkippedFor, setDaySetupSkippedFor] = useState<string | null>(null);

  const showDaySetupModal =
    !shareMode &&
    (daySetupOpen ||
      (selectedDay === todayIso() && !dayState.wakeTime && daySetupSkippedFor !== selectedDay));

  const handleDaySetupSave = useCallback(
    (wakeTime: string, sleepTarget: string, bedTime: string) => {
      updateAppState((prev) => {
        const existing = getOrCreateDay(prev, selectedDay);
        // Clear manual block overrides so blocks recompute from new wake/sleep times.
        return {
          ...prev,
          days: { ...prev.days, [selectedDay]: { ...existing, bedTime, wakeTime, sleepTarget, blockDurations: null } },
        };
      });
      setDaySetupOpen(false);
    },
    [updateAppState, selectedDay],
  );

  // --- Block duration editor state ---
  const [sleepWarnPending, setSleepWarnPending] = useState<{
    durations: BlockDurations; newSleepMinutes: number;
  } | null>(null);

  const [conflictPending, setConflictPending] = useState<ConflictPending | null>(null);

  const [durationScopePending, setDurationScopePending] = useState<DurationScopePending | null>(null);

  const applyDurationScopeToday = useCallback(() => {
    if (!durationScopePending) return;
    const { durations, newSleepTarget, afterApply } = durationScopePending;
    updateAppState((prev) => {
      const existing = getOrCreateDay(prev, selectedDay);
      const patch: Partial<DayState> = { blockDurations: durations };
      if (newSleepTarget !== null) patch.sleepTarget = newSleepTarget;
      let next: AppState = {
        ...prev,
        days: { ...prev.days, [selectedDay]: { ...existing, ...patch } },
      };
      if (afterApply) next = afterApply(next);
      return next;
    });
    setDurationScopePending(null);
  }, [durationScopePending, updateAppState, selectedDay]);

  const applyDurationScopeAllDays = useCallback(() => {
    if (!durationScopePending) return;
    const { durations, newSleepTarget, afterApply } = durationScopePending;
    const ratios = blockDurationsToRatios(durations);
    updateAppState((prev) => {
      const nextDays = { ...prev.days };
      for (const date of Object.keys(nextDays)) {
        const day = nextDays[date];
        if (day) nextDays[date] = { ...day, blockDurations: null };
      }
      const existing = getOrCreateDay(prev, selectedDay);
      const dayPatch: Partial<DayState> = { blockDurations: null };
      if (newSleepTarget !== null) dayPatch.sleepTarget = newSleepTarget;
      nextDays[selectedDay] = { ...existing, ...dayPatch };
      let next: AppState = {
        ...prev,
        days: nextDays,
        blockDurationRatios: ratios,
      };
      if (afterApply) next = afterApply(next);
      return next;
    });
    setDurationScopePending(null);
  }, [durationScopePending, updateAppState, selectedDay]);

  const handleBlockDurationChange = useCallback(
    (sectionId: keyof BlockDurations, newDurationMinutes: number) => {
      if (!effectiveBlockDurations || !dayState.wakeTime || !dayState.sleepTarget) return;

      const currentSleepMins = (() => {
        const [wh, wm] = (dayState.wakeTime ?? "07:00").split(":").map(Number);
        const [sh, sm] = (dayState.sleepTarget ?? "23:00").split(":").map(Number);
        const wake = (wh ?? 0) * 60 + (wm ?? 0);
        const sleep = (sh ?? 0) * 60 + (sm ?? 0);
        return wake > sleep ? wake - sleep : wake + 1440 - sleep;
      })();

      const result = applyBlockDurationChange(
        effectiveBlockDurations,
        sectionId,
        newDurationMinutes,
        currentSleepMins,
      );
      if (!result) return; // hard minimum violated

      // Compute new sleep target string if sleep minutes changed
      const newSleepTarget: string | null = result.sleepMinutes !== currentSleepMins
        ? (() => {
            const [wh, wm] = (dayState.wakeTime ?? "07:00").split(":").map(Number);
            const totalMin = ((wh ?? 0) * 60 + (wm ?? 0) + result.sleepMinutes) % 1440;
            return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
          })()
        : null;

      // Check for task conflicts in the changed block
      const blockIdx = BLOCK_ORDER.indexOf(sectionId);
      const newBlocks = computeBlocksFromDurations(dayState.wakeTime, result.durations);
      const newBlock = newBlocks[blockIdx];

      if (newBlock) {
        const blockStartMins = newBlock.start;
        const blockEndMins = newBlock.end >= newBlock.start ? newBlock.end : newBlock.end + 1440;
        const conflicts = (dayState.tasks ?? []).filter(
          (t) =>
            t.sectionId === sectionId &&
            t.scheduledAt &&
            (() => {
              const [th, tm] = t.scheduledAt!.split(":").map(Number);
              const taskMin = (th ?? 0) * 60 + (tm ?? 0);
              const adj = taskMin < blockStartMins ? taskMin + 1440 : taskMin;
              return adj < blockStartMins || adj >= blockEndMins;
            })(),
        );

        if (conflicts.length > 0) {
          const section = FIXED_SECTIONS.find((s) => s.id === sectionId);
          const nextId = blockIdx < BLOCK_ORDER.length - 1 ? BLOCK_ORDER[blockIdx + 1] ?? null : null;
          const nextSection = nextId ? FIXED_SECTIONS.find((s) => s.id === nextId) : null;
          const fmt = (m: number) =>
            `${String(Math.floor(m % 1440 / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

          // Sleep warn first if applicable
          if (result.sleepWarning) {
            setSleepWarnPending({ durations: result.durations, newSleepMinutes: result.sleepMinutes });
            return;
          }

          setConflictPending({
            durations: result.durations,
            newSleepTarget,
            blockName: section?.title ?? sectionId,
            newBlockStart: fmt(newBlock.start),
            newBlockEnd: fmt(newBlock.end),
            tasks: conflicts,
            nextSectionId: nextId as TaskSectionId | null,
            nextBlockName: nextSection?.title ?? null,
          });
          return;
        }
      }

      // Sleep warning (no task conflicts)
      if (result.sleepWarning) {
        setSleepWarnPending({ durations: result.durations, newSleepMinutes: result.sleepMinutes });
        return;
      }

      setDurationScopePending({
        durations: result.durations,
        newSleepTarget,
        afterApply: undefined,
      });
    },
    [effectiveBlockDurations, dayState],
  );

  return {
    effectiveBlockDurations,
    computedBlocks,
    daySetupOpen,
    setDaySetupOpen,
    daySetupSkippedFor,
    setDaySetupSkippedFor,
    showDaySetupModal,
    sleepWarnPending,
    setSleepWarnPending,
    conflictPending,
    setConflictPending,
    durationScopePending,
    setDurationScopePending,
    handleDaySetupSave,
    applyDurationScopeToday,
    applyDurationScopeAllDays,
    handleBlockDurationChange,
  };
}
