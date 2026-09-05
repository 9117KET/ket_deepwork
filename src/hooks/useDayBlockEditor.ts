/**
 * hooks/useDayBlockEditor.ts
 *
 * State machine for the day schedule / block duration editor.
 * Handles the DaySetupModal, sleep-warning confirmation, conflict resolution,
 * and the scope modal (today-only vs. all-days-default).
 */

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_TASK_MINUTES_BY_SECTION,
  FIXED_SECTIONS,
  type AppState,
  type BlockDurations,
  type DayState,
  type RoutineMinutes,
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
  computeCapacityAwareBlocks,
  computePlannedMinutesBySection,
  computeSleepWindow,
  getDefaultBlockDurations,
  ratiosToBlockDurations,
  sleepMinutesFromTarget,
  sleepTargetFromMinutes,
  type CapacityResult,
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
  routineMinutes: AppState['routineMinutes'],
  selectedDay: string,
  updateAppState: (updater: (prev: AppState) => AppState) => void,
  shareMode: 'view' | 'edit' | undefined,
) {
  // Planned minutes per block from the day's tasks (Top 3 folds into High).
  const plannedBySection = useMemo(
    () => computePlannedMinutesBySection(dayState.tasks ?? []),
    [dayState.tasks],
  );

  // Proportional "shape" floors: the global ratio template if the user set one,
  // otherwise the wake/sleep default split. Capacity-aware sizing expands from these.
  const blockFloors = useMemo<BlockDurations | null>(() => {
    if (!dayState.wakeTime || !dayState.sleepTarget) return null;
    if (blockDurationRatios) {
      const awake = computeAwakeMinutes(dayState.wakeTime, dayState.sleepTarget);
      return ratiosToBlockDurations(blockDurationRatios, awake);
    }
    return getDefaultBlockDurations(dayState.wakeTime, dayState.sleepTarget, routineMinutes);
  }, [dayState.wakeTime, dayState.sleepTarget, blockDurationRatios, routineMinutes]);

  // Capacity-aware, bedtime-anchored sizing (null when wake/sleep not set).
  const capacity = useMemo<CapacityResult | null>(() => {
    if (!dayState.wakeTime || !dayState.sleepTarget || !blockFloors) return null;
    return computeCapacityAwareBlocks(
      dayState.wakeTime, dayState.sleepTarget, plannedBySection, blockFloors, routineMinutes,
    );
  }, [dayState.wakeTime, dayState.sleepTarget, plannedBySection, blockFloors, routineMinutes]);

  // Whether the user has manually pinned this day's block sizes.
  const isManualOverride = Boolean(dayState.blockDurations);

  // Resolved block minutes: per-day manual override > capacity-aware sizing > floors.
  const effectiveBlockDurations = useMemo<BlockDurations | null>(() => {
    if (dayState.blockDurations) return dayState.blockDurations;
    return capacity?.durations ?? blockFloors;
  }, [dayState.blockDurations, capacity, blockFloors]);

  // Total time allocated to today's Top 3 (mustDo) tasks. These are executed
  // inside the high-priority deep-work block, so their duration is folded into
  // that block's window (pushing later blocks later) rather than being scheduled
  // on their own. Done tasks are still counted so the timeline stays stable as
  // the day progresses. Tasks without an explicit duration use the same per-section
  // default as computePlannedMinutesBySection, so the note and the manual-override
  // fold agree with the capacity-aware sizing (which already reserves that default).
  const mustDoMinutes = useMemo(
    () =>
      (dayState.tasks ?? [])
        .filter((t) => t.sectionId === 'mustDo' && !t.parentId)
        .reduce((sum, t) => sum + (t.durationMinutes ?? DEFAULT_TASK_MINUTES_BY_SECTION.mustDo), 0),
    [dayState.tasks],
  );

  // Per-day timeline blocks derived from effective durations. The high-priority
  // block is extended by the Top 3 total so its window reflects that work.
  const computedBlocks = useMemo(() => {
    if (!dayState.wakeTime || !dayState.sleepTarget || !effectiveBlockDurations) return undefined;
    // Capacity-aware durations already fold Top 3 into High; only add it on top of a
    // manual override (where High is the user's raw, un-folded number).
    const timelineDurations =
      isManualOverride && mustDoMinutes > 0
        ? { ...effectiveBlockDurations, highPriority: effectiveBlockDurations.highPriority + mustDoMinutes }
        : effectiveBlockDurations;
    return computeBlocksFromDurations(dayState.wakeTime, timelineDurations);
  }, [dayState.wakeTime, dayState.sleepTarget, effectiveBlockDurations, isManualOverride, mustDoMinutes]);

  // The night, anchored on the bedtime the user set: the plan finishing early
  // buys open evening, not sleep. Only an overrun moves bedtime later.
  const sleepWindow = useMemo(
    () => computeSleepWindow(computedBlocks, dayState.wakeTime, dayState.sleepTarget),
    [computedBlocks, dayState.wakeTime, dayState.sleepTarget],
  );

  // Modal state: auto-open when today has no wake time; "Edit schedule" forces it open.
  const [daySetupOpen, setDaySetupOpen] = useState(false);
  /**
   * The day the user explicitly skipped, remembered for the session rather than
   * for the render.
   *
   * As plain component state this reset on every reload, so "Skip for today"
   * bought you nothing: refresh the planner and the modal was in the way again,
   * with no way past it short of filling in a wake time. Session-scoped is the
   * right lifetime - the skip should not follow you into tomorrow, and it
   * should survive a refresh today.
   */
  const [daySetupSkippedFor, setDaySetupSkippedFor] = useState<string | null>(
    () => readSkippedDaySetup(),
  );

  const skipDaySetupFor = useCallback((iso: string) => {
    setDaySetupSkippedFor(iso);
    writeSkippedDaySetup(iso);
  }, []);

  const showDaySetupModal =
    !shareMode &&
    (daySetupOpen ||
      (selectedDay === todayIso() && !dayState.wakeTime && daySetupSkippedFor !== selectedDay));

  // Drop this day's manual block sizes so blocks revert to capacity-aware auto sizing.
  const resetBlocksToAuto = useCallback(() => {
    updateAppState((prev) => {
      const existing = getOrCreateDay(prev, selectedDay);
      return {
        ...prev,
        days: { ...prev.days, [selectedDay]: { ...existing, blockDurations: null } },
      };
    });
  }, [updateAppState, selectedDay]);

  const handleDaySetupSave = useCallback(
    (wakeTime: string, sleepTarget: string, bedTime: string, routine: RoutineMinutes) => {
      updateAppState((prev) => {
        const existing = getOrCreateDay(prev, selectedDay);
        // Clear manual block overrides so blocks recompute from new wake/sleep times.
        // Routine lengths are a fact about the person, not the day, so they are
        // stored once globally rather than re-answered every morning.
        return {
          ...prev,
          routineMinutes: routine,
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

      const currentSleepMins = sleepMinutesFromTarget(
        dayState.wakeTime ?? "07:00",
        dayState.sleepTarget ?? "23:00",
      );

      const result = applyBlockDurationChange(
        effectiveBlockDurations,
        sectionId,
        newDurationMinutes,
        currentSleepMins,
      );
      if (!result) return; // hard minimum violated

      // Compute new sleep target string if sleep minutes changed
      const newSleepTarget: string | null = result.sleepMinutes !== currentSleepMins
        ? sleepTargetFromMinutes(dayState.wakeTime ?? "07:00", result.sleepMinutes)
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
    sleepWindow,
    mustDoMinutes,
    plannedBySection,
    capacity,
    isManualOverride,
    resetBlocksToAuto,
    daySetupOpen,
    setDaySetupOpen,
    daySetupSkippedFor,
    skipDaySetupFor,
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

const DAY_SETUP_SKIP_KEY = 'deepblock_day_setup_skipped';

function readSkippedDaySetup(): string | null {
  try {
    return sessionStorage.getItem(DAY_SETUP_SKIP_KEY);
  } catch {
    return null;
  }
}

function writeSkippedDaySetup(iso: string): void {
  try {
    sessionStorage.setItem(DAY_SETUP_SKIP_KEY, iso);
  } catch {
    // sessionStorage unavailable (private mode) - the skip lasts this render only
  }
}
