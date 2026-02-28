/**
 * components/planner/DayPlanner.tsx
 *
 * Orchestrates the selected date, tasks, and layout for the main planner view.
 * This component ties together storage + domain logic + UI sections.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppState } from '../../domain/types'
import { FIXED_SECTIONS, type TaskSectionId, type Task } from '../../domain/types'
import { addDays, todayIso, sameWeekdayLastWeek, normalizeHhmm } from '../../domain/dateUtils'
import { usePersistentState, getOrCreateDay } from '../../storage/localStorageState'
import { DayHeader } from './DayHeader'
import { SectionColumn } from './SectionColumn'
import { WeeklyOverview } from './WeeklyOverview'
import { DeepWorkTimer } from '../timer/DeepWorkTimer'
import { MotivationCard } from '../timer/MotivationCard'

function formatDateLabel(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map((part) => Number(part))
  const date = new Date(year, month - 1, day)
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return formatter.format(date)
}

function createTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Reorder array: move item at fromIndex to toIndex (0 = top). */
function reorderTasks<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return arr
  const copy = [...arr]
  const [removed] = copy.splice(fromIndex, 1)
  const insertIdx = fromIndex < toIndex ? toIndex - 1 : toIndex
  copy.splice(insertIdx, 0, removed)
  return copy
}

/** Clone tasks for another day: new IDs, same content and times. */
function cloneTasksForDay(tasks: Task[], targetDate: string): Task[] {
  return tasks.map((t) => ({
    ...t,
    id: createTaskId(),
    date: targetDate,
    isDone: false,
  }))
}

export function DayPlanner() {
  const [appState, updateAppState] = usePersistentState()
  const [selectedDay, setSelectedDay] = useState<string>(todayIso)

  const dayState = useMemo(() => getOrCreateDay(appState, selectedDay), [appState, selectedDay])

  const handleAddTask = (sectionId: TaskSectionId, title: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay)
      const nextTasks: Task[] = [
        ...existingDay.tasks,
        {
          id: createTaskId(),
          title,
          sectionId,
          date: selectedDay,
          isDone: false,
        },
      ]

      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: {
            ...existingDay,
            tasks: nextTasks,
          },
        },
      }
    })
  }

  const handleToggleTask = (taskId: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay)
      const nextTasks = existingDay.tasks.map((task) =>
        task.id === taskId ? { ...task, isDone: !task.isDone } : task,
      )

      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: {
            ...existingDay,
            tasks: nextTasks,
          },
        },
      }
    })
  }

  const handleDeleteTask = (taskId: string) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay)
      const nextTasks = existingDay.tasks.filter((task) => task.id !== taskId)

      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: {
            ...existingDay,
            tasks: nextTasks,
          },
        },
      }
    })
  }

  const handleReorderTask = (sectionId: TaskSectionId, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay)
      const sectionTasks = existingDay.tasks.filter((t) => t.sectionId === sectionId)
      const reordered = reorderTasks(sectionTasks, fromIndex, toIndex)
      let j = 0
      const nextTasks = existingDay.tasks.map((t) =>
        t.sectionId === sectionId ? reordered[j++]! : t,
      )
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: nextTasks },
        },
      }
    })
  }

  const handleCopyFromPreviousDay = () => {
    const prevDay = addDays(selectedDay, -1)
    const sourceDayState = getOrCreateDay(appState, prevDay)
    if (sourceDayState.tasks.length === 0) return
    const newTasks = cloneTasksForDay(sourceDayState.tasks, selectedDay)
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay)
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: newTasks },
        },
      }
    })
  }

  const handleFillFromLastWeekday = () => {
    const sourceDay = sameWeekdayLastWeek(selectedDay)
    const sourceDayState = getOrCreateDay(appState, sourceDay)
    if (sourceDayState.tasks.length === 0) return
    const newTasks = cloneTasksForDay(sourceDayState.tasks, selectedDay)
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay)
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: newTasks },
        },
      }
    })
  }

  const handleUpdateTask = (
    taskId: string,
    patch: { scheduledAt?: string; durationMinutes?: number },
  ) => {
    updateAppState((prev) => {
      const existingDay = getOrCreateDay(prev, selectedDay)
      const nextTasks = existingDay.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      )
      return {
        ...prev,
        days: {
          ...prev.days,
          [selectedDay]: { ...existingDay, tasks: nextTasks },
        },
      }
    })
  }

  const tasksBySection: Record<TaskSectionId, Task[]> = useMemo(() => {
    const grouped: Record<TaskSectionId, Task[]> = {
      mustDo: [],
      morningRoutine: [],
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
      nightRoutine: [],
    }

    for (const task of dayState.tasks) {
      grouped[task.sectionId]?.push(task)
    }

    return grouped
  }, [dayState.tasks])

  const prevDay = addDays(selectedDay, -1)
  const lastWeekday = sameWeekdayLastWeek(selectedDay)
  const prevDayState = useMemo(() => getOrCreateDay(appState, prevDay), [appState, prevDay])
  const lastWeekdayState = useMemo(
    () => getOrCreateDay(appState, lastWeekday),
    [appState, lastWeekday],
  )
  const weekdayLabel = useMemo(() => {
    const [y, m, d] = selectedDay.split('-').map(Number)
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
      new Date(y!, m! - 1, d!),
    )
  }, [selectedDay])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  const taskIdsDueNow = useMemo(() => {
    void tick // re-run when tick updates (every 15s) so due-now matches current time
    const today = todayIso()
    const day = getOrCreateDay(appState, today)
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const set = new Set<string>()
    for (const task of day.tasks) {
      if (!task.scheduledAt || task.isDone) continue
      const normalized = normalizeHhmm(task.scheduledAt)
      if (normalized === hhmm) set.add(task.id)
    }
    return set
  }, [appState, tick])

  const lastBeepedRef = useRef<string | null>(null)
  useEffect(() => {
    if (taskIdsDueNow.size === 0) return
    const now = new Date()
    const minuteKey = `${now.getHours()}:${now.getMinutes()}`
    if (lastBeepedRef.current === minuteKey) return
    lastBeepedRef.current = minuteKey
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // ignore
    }
  }, [taskIdsDueNow])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div
        className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 pb-3 backdrop-blur-sm"
        data-tour="date-nav"
      >
        <DayHeader
          dateLabel={formatDateLabel(selectedDay)}
          onPrevDay={() => setSelectedDay((current) => addDays(current, -1))}
          onNextDay={() => setSelectedDay((current) => addDays(current, 1))}
          onToday={() => setSelectedDay(todayIso())}
        />
        {/* Last week same day has priority; copy from yesterday only when no last-weekday data */}
        {lastWeekdayState.tasks.length > 0 ? (
          <div className="mt-2 text-xs" data-tour="fill-day">
            <button
              type="button"
              onClick={handleFillFromLastWeekday}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-300 hover:border-sky-600 hover:text-sky-300"
            >
              Fill from last {weekdayLabel}
            </button>
          </div>
        ) : prevDayState.tasks.length > 0 ? (
          <div className="mt-2 text-xs" data-tour="fill-day">
            <button
              type="button"
              onClick={handleCopyFromPreviousDay}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-300 hover:border-sky-600 hover:text-sky-300"
            >
              Copy from yesterday
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3" data-tour="tasks-section">
          {FIXED_SECTIONS.map((section) => (
            <SectionColumn
              key={section.id}
              section={section}
              tasks={tasksBySection[section.id]}
              onAddTask={(title) => handleAddTask(section.id, title)}
              onToggleTask={(taskId) => handleToggleTask(taskId)}
              onDeleteTask={(taskId) => handleDeleteTask(taskId)}
              onReorder={(fromIndex, toIndex) => handleReorderTask(section.id, fromIndex, toIndex)}
              onUpdateTask={handleUpdateTask}
              taskIdsDueNow={taskIdsDueNow}
            />
          ))}
        </div>
        <div className="space-y-3 lg:sticky lg:top-20" data-tour="sidebar">
          <WeeklyOverview state={appState as AppState} referenceDay={selectedDay} />
          <DeepWorkTimer />
          <MotivationCard />
        </div>
      </div>
    </div>
  )
}

