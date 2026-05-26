/**
 * components/planner/PlannerModals.tsx
 *
 * All modal overlays rendered by DayPlanner, extracted to keep DayPlanner lean.
 */

import type { DayState, HabitDefinition, SideQuestDef } from "../../domain/types";
import type { useDayBlockEditor } from "../../hooks/useDayBlockEditor";
import { getOrCreateDay } from "../../storage/localStorageState";
import { DaySetupModal } from "./DaySetupModal";
import { BlockDurationScopeModal } from "./BlockDurationScopeModal";
import { TaskConflictModal } from "./TaskConflictModal";
import { HabitEditorModal } from "../habits/HabitEditorModal";
import { SideQuestEditorModal } from "./SideQuestEditorModal";

interface PlannerModalsProps {
  selectedDay: string;
  dayState: DayState;
  prevDayState: DayState;
  blockEditor: ReturnType<typeof useDayBlockEditor>;
  habits: HabitDefinition[];
  sideQuestDefs: SideQuestDef[];
  editHabitsOpen: boolean;
  editSideQuestOpen: boolean;
  onCloseHabits: () => void;
  onCloseSideQuests: () => void;
  onSaveHabits: (habits: HabitDefinition[]) => void;
  onSaveSideQuests: (defs: SideQuestDef[]) => void;
}

export function PlannerModals({
  selectedDay,
  dayState,
  prevDayState,
  blockEditor,
  habits,
  sideQuestDefs,
  editHabitsOpen,
  editSideQuestOpen,
  onCloseHabits,
  onCloseSideQuests,
  onSaveHabits,
  onSaveSideQuests,
}: PlannerModalsProps) {
  const {
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
    setDaySetupSkippedFor,
    setDaySetupOpen,
  } = blockEditor;

  return (
    <>
      {/* Day setup modal: prompts for wake/sleep times on today's fresh planner */}
      {showDaySetupModal && (
        <DaySetupModal
          date={selectedDay}
          initialBedTime={dayState.bedTime}
          initialWakeTime={dayState.wakeTime}
          initialSleepTarget={dayState.sleepTarget}
          prevBedTime={prevDayState.bedTime}
          prevWakeTime={prevDayState.wakeTime}
          prevSleepTarget={prevDayState.sleepTarget}
          onSave={handleDaySetupSave}
          onSkip={() => { setDaySetupSkippedFor(selectedDay); setDaySetupOpen(false); }}
        />
      )}

      {/* Sleep warning confirmation */}
      {sleepWarnPending && dayState.wakeTime && (() => {
        const { durations, newSleepMinutes } = sleepWarnPending;
        const [wh, wm] = (dayState.wakeTime ?? "07:00").split(":").map(Number);
        const totalMin = ((wh ?? 0) * 60 + (wm ?? 0) + newSleepMinutes) % 1440;
        const newTarget = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        const h = Math.floor(newSleepMinutes / 60);
        const m = newSleepMinutes % 60;
        const label = m === 0 ? `${h}h` : `${h}h ${m}m`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-share-bg/90 px-4">
            <div className="w-full max-w-sm rounded-xl border border-amber-500/30 bg-share-surfaceContainerHigh p-5 shadow-2xl">
              <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-amber-400">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-share-onBg">Sleep will drop to {label}</h3>
                  <p className="mt-1 text-xs text-share-onSurfaceVariant">
                    Sleep below 7 hours affects focus, memory, and performance. This change will update your bedtime target to {newTarget}.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDurationScopePending({
                      durations,
                      newSleepTarget: newTarget,
                      afterApply: undefined,
                    });
                    setSleepWarnPending(null);
                  }}
                  className="flex-1 rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                >
                  Apply anyway
                </button>
                <button
                  onClick={() => setSleepWarnPending(null)}
                  className="flex-1 rounded-lg border border-share-outlineVariant/40 py-2 text-xs font-medium text-share-onSurfaceVariant hover:text-share-onBg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Task conflict modal */}
      {conflictPending && (
        <TaskConflictModal
          blockName={conflictPending.blockName}
          newStart={conflictPending.newBlockStart}
          newEnd={conflictPending.newBlockEnd}
          conflictingTasks={conflictPending.tasks}
          nextBlockName={conflictPending.nextBlockName}
          onKeep={() => {
            const c = conflictPending;
            setDurationScopePending({
              durations: c.durations,
              newSleepTarget: c.newSleepTarget,
              afterApply: undefined,
            });
            setConflictPending(null);
          }}
          onClear={() => {
            const c = conflictPending;
            const toClear = c.tasks;
            setDurationScopePending({
              durations: c.durations,
              newSleepTarget: c.newSleepTarget,
              afterApply: (next) => {
                const existing = getOrCreateDay(next, selectedDay);
                const tasks = existing.tasks.map((t) =>
                  toClear.some((x) => x.id === t.id) ? { ...t, scheduledAt: undefined } : t,
                );
                return { ...next, days: { ...next.days, [selectedDay]: { ...existing, tasks } } };
              },
            });
            setConflictPending(null);
          }}
          onMove={conflictPending.nextSectionId ? () => {
            const c = conflictPending;
            const nid = c.nextSectionId!;
            const toMove = c.tasks;
            setDurationScopePending({
              durations: c.durations,
              newSleepTarget: c.newSleepTarget,
              afterApply: (next) => {
                const existing = getOrCreateDay(next, selectedDay);
                const tasks = existing.tasks.map((t) =>
                  toMove.some((x) => x.id === t.id)
                    ? { ...t, sectionId: nid, scheduledAt: undefined }
                    : t,
                );
                return { ...next, days: { ...next.days, [selectedDay]: { ...existing, tasks } } };
              },
            });
            setConflictPending(null);
          } : null}
        />
      )}

      {/* Block duration scope: today-only or all-days-default */}
      {durationScopePending && (
        <BlockDurationScopeModal
          onThisDayOnly={applyDurationScopeToday}
          onAllDaysDefault={applyDurationScopeAllDays}
          onCancel={() => setDurationScopePending(null)}
        />
      )}

      {/* Habit editor */}
      {editHabitsOpen && (
        <HabitEditorModal
          habits={habits}
          onSave={onSaveHabits}
          onClose={onCloseHabits}
        />
      )}

      {/* Side quest editor */}
      {editSideQuestOpen && (
        <SideQuestEditorModal
          defs={sideQuestDefs}
          onSave={onSaveSideQuests}
          onClose={onCloseSideQuests}
        />
      )}
    </>
  );
}
