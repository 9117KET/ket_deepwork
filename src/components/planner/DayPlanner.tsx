/**
 * components/planner/DayPlanner.tsx
 *
 * Orchestrates the selected date, tasks, and layout for the main planner view.
 * This component ties together storage + domain logic + UI sections.
 */

import { useMemo, useState } from 'react'
import type { AppState } from '../../domain/types'
import { FIXED_SECTIONS, type TaskSectionId, type Task } from '../../domain/types'
import { addDays, todayIso } from '../../domain/dateUtils'
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 pb-3 backdrop-blur-sm">
        <DayHeader
          dateLabel={formatDateLabel(selectedDay)}
          onPrevDay={() => setSelectedDay((current) => addDays(current, -1))}
          onNextDay={() => setSelectedDay((current) => addDays(current, 1))}
          onToday={() => setSelectedDay(todayIso())}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          {FIXED_SECTIONS.map((section) => (
            <SectionColumn
              key={section.id}
              section={section}
              tasks={tasksBySection[section.id]}
              onAddTask={(title) => handleAddTask(section.id, title)}
              onToggleTask={(taskId) => handleToggleTask(taskId)}
              onDeleteTask={(taskId) => handleDeleteTask(taskId)}
            />
          ))}
        </div>
        <div className="space-y-3 lg:sticky lg:top-20">
          <WeeklyOverview state={appState as AppState} referenceDay={selectedDay} />
          <DeepWorkTimer />
          <MotivationCard />
        </div>
      </div>
    </div>
  )
}

