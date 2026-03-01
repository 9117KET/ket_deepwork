/**
 * domain/types.ts
 *
 * Core domain types for the Deepblock planner.
 * This keeps UI components simple and enforces a clear data model.
 */

export type TaskSectionId =
  | 'mustDo'
  | 'morningRoutine'
  | 'highPriority'
  | 'mediumPriority'
  | 'lowPriority'
  | 'nightRoutine'

export interface TaskSection {
  id: TaskSectionId
  title: string
  description?: string
}

export interface Task {
  id: string
  title: string
  sectionId: TaskSectionId
  date: string // ISO date string: YYYY-MM-DD in local time
  isDone: boolean
  /** Parent task id; when set, this task is a subtask. Completing parent marks all subtasks done. */
  parentId?: string
  /** Time of day to start/remind (local), e.g. "09:00". */
  scheduledAt?: string
  /** Planned duration in minutes (for display / future timer link). */
  durationMinutes?: number
}

export interface DeepWorkSession {
  id: string
  label: string
  durationMinutes: number
  startedAt: string // ISO timestamp
  finishedAt?: string
  cancelledAt?: string
}

export interface DayState {
  date: string
  tasks: Task[]
  deepWorkSessions: DeepWorkSession[]
}

export interface AppState {
  days: Record<string, DayState | undefined>
}

export interface WeeklyStatsDaySummary {
  date: string
  completedCount: number
  totalCount: number
}

export interface WeeklyStats {
  days: WeeklyStatsDaySummary[]
  totalCompleted: number
  totalTasks: number
}

export const FIXED_SECTIONS: TaskSection[] = [
  {
    id: 'mustDo',
    title: '3 things that MUST be done today',
  },
  {
    id: 'morningRoutine',
    title: 'Morning routine',
    description: 'Timeframe: 5 to 9',
  },
  {
    id: 'highPriority',
    title: 'High Priority (Focus Tasks)',
    description: 'Timeframe: 9 to 5',
  },
  {
    id: 'mediumPriority',
    title: 'Medium Priority (Supplementary Tasks)',
  },
  {
    id: 'lowPriority',
    title: 'Low Priority (Optional)',
  },
  {
    id: 'nightRoutine',
    title: 'Night routine',
  },
]

