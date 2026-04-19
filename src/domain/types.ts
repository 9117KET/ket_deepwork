/**
 * domain/types.ts
 *
 * Core domain types for the Deepblock planner.
 * This keeps UI components simple and enforces a clear data model.
 */

export type TaskSectionId =
  | "mustDo"
  | "morningRoutine"
  | "highPriority"
  | "mediumPriority"
  | "lowPriority"
  | "nightRoutine";

export interface TaskSection {
  id: TaskSectionId;
  title: string;
  description?: string;
}

export interface Task {
  id: string;
  title: string;
  sectionId: TaskSectionId;
  date: string; // ISO date string: YYYY-MM-DD in local time
  isDone: boolean;
  /** Parent task id; when set, this task is a subtask. Completing parent marks all subtasks done. */
  parentId?: string;
  /** Time of day to start/remind (local), e.g. "09:00". */
  scheduledAt?: string;
  /** Planned duration in minutes (for display / future timer link). */
  durationMinutes?: number;
  /** Number of times this task has been carried forward from a previous day. */
  postponedCount?: number;
  /** True when this task is shallow work (logistical, non-cognitively demanding). */
  isShallow?: boolean;
}

/** A conscious commitment to NOT do something (Drucker's not-to-do list). */
export interface NotDoingItem {
  id: string;
  text: string;
  /** ISO date when this commitment was made. */
  createdAt: string;
}

/** A task that was consciously abandoned (as opposed to silently deleted). */
export interface AbandonedTask {
  id: string;
  title: string;
  sectionId: TaskSectionId;
  /** ISO date when the task was abandoned. */
  abandonedAt: string;
}

export interface DeepWorkSession {
  id: string;
  label: string;
  durationMinutes: number;
  startedAt: string; // ISO timestamp
  finishedAt?: string;
  cancelledAt?: string;
}

export interface DayState {
  date: string;
  tasks: Task[];
  deepWorkSessions: DeepWorkSession[];
  /** Habit id -> completed for this day (tracking dashboard). */
  habitCompletions?: Record<string, boolean>;
  /** Per-day not-doing decisions (Drucker: conscious commitments to not pursue something today). */
  notDoingItems?: NotDoingItem[];
  /** Tasks consciously abandoned this day (Drucker: abandonment as a success). */
  abandonedTasks?: AbandonedTask[];
  /** Sleep duration in hours, e.g. 6, 7, 8 (null = not set). */
  sleepHours?: number | null;
  /** Mood emoji or code, e.g. "🙂" (null = not set). */
  mood?: string | null;
  /** Local time user went to bed the previous night (HH:MM 24h), e.g. "23:00" (null = not set). */
  bedTime?: string | null;
  /** Local time user woke up (HH:MM 24h), e.g. "06:30" (null = not set). */
  wakeTime?: string | null;
  /** Local time user plans to sleep tonight (HH:MM 24h), e.g. "23:00" (null = not set). */
  sleepTarget?: string | null;
  /** Per-day manual overrides for time-block durations (minutes). When set, overrides auto-computed blocks. */
  blockDurations?: BlockDurations | null;
}

/**
 * Manual duration overrides for each awake section block (minutes).
 * All five values must sum to the total awake window (sleepTarget - wakeTime).
 */
export interface BlockDurations {
  morningRoutine: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  nightRoutine: number;
}

/** Fractional split of the awake window across blocks (each 0–1, sum ≈ 1). */
export type BlockDurationRatios = Record<keyof BlockDurations, number>;

export interface HabitDefinition {
  id: string;
  label: string;
  /** "After [stackAnchor], I will do this habit." Free-text anchor for habit stacking. */
  stackAnchor?: string;
}

/** The ONE Thing goal cascade (Gary Keller): long-horizon goals from life down to 3 months. */
export interface GoalCascade {
  life?: string;
  fiveYear?: string;
  oneYear?: string;
  sixMonths?: string;
  threeMonths?: string;
}

/** Monthly review answers for The ONE Thing framework. */
export interface MonthlyReview {
  /** Free-text answers indexed to the user's monthly review questions. */
  answers: string[];
  /** ISO timestamp when the user marked this review complete. */
  completedAt?: string;
}

export interface AppState {
  days: Record<string, DayState | undefined>;
  /**
   * Global offset (in minutes) applied to all time-of-day blocks.
   * 0 = use default timeframes (5–9 morning, 9–5 focus, etc.).
   * Positive = shift blocks later, negative = earlier. Clamped to ±180.
   */
  timeOffsetMinutes?: number;
  /** User-defined habits for the tracking dashboard (synced when signed in). */
  habitDefinitions?: HabitDefinition[];
  /** Month id (YYYY-MM) -> chapter title, e.g. "The Foundation". */
  monthTitles?: Record<string, string>;
  /** ISO dates (YYYY-MM-DD) when the app was opened; streak is computed from this so no days are lost. */
  activeDays?: string[];
  /**
   * Default time-block split for every day (derived from proportions of awake time).
   * When set, days without `blockDurations` use this template scaled to that day's wake/sleep window.
   */
  blockDurationRatios?: BlockDurationRatios | null;
  /** Global persistent not-doing commitments (Drucker: things you've decided to stop doing entirely). */
  notDoingList?: NotDoingItem[];
  /** "I am X" identity declaration (Atomic Habits). Displayed as a daily commitment alongside habits. */
  identityStatement?: string;
  /** Cal Newport depth philosophy: how the user structures their deep work time. */
  depthPhilosophy?: 'rhythmic' | 'journalistic' | 'bimodal';
  /** Weekly deep work goal in hours (default 20). Used by the scoreboard. */
  deepWorkGoalHoursPerWeek?: number;
  // ── The ONE Thing (Gary Keller) ──────────────────────────────────────────────
  /** Fixed life direction statement — the "North Star" that guides every decision. */
  northStar?: string;
  /** Cascading long-horizon goals from life down to 3 months. */
  goalCascade?: GoalCascade;
  /** ISO date → the ONE thing for that specific day. */
  dayOneThings?: Record<string, string>;
  /** Monday ISO date → the ONE thing for that week. */
  weekOneThings?: Record<string, string>;
  /** YYYY-MM → the ONE thing for that month. */
  monthOneThings?: Record<string, string>;
  /** YYYY-MM → monthly review answers. */
  monthlyReviews?: Record<string, MonthlyReview>;
  /** Customisable monthly review question list (defaults to the 7 standard questions). */
  monthlyReviewQuestions?: string[];
}

export interface WeeklyStatsDaySummary {
  date: string;
  completedCount: number;
  totalCount: number;
}

export interface WeeklyStats {
  days: WeeklyStatsDaySummary[];
  totalCompleted: number;
  totalTasks: number;
}

export const FIXED_SECTIONS: TaskSection[] = [
  {
    id: "mustDo",
    title: "3 MUST Todo task today",
  },
  {
    id: "morningRoutine",
    title: "Morning routine",
    description: "Use for wake-up and morning prep tasks.",
  },
  {
    id: "highPriority",
    title: "High Priority (Focus Tasks)",
    description: "Deep focus work that moves the needle.",
  },
  {
    id: "mediumPriority",
    title: "Medium Priority (Supplementary Tasks)",
    description: "Important but not mission-critical tasks.",
  },
  {
    id: "lowPriority",
    title: "Low Priority (Optional)",
    description: "Nice-to-have or optional tasks.",
  },
  {
    id: "nightRoutine",
    title: "Night routine",
    description: "Wind-down and end-of-day tasks.",
  },
];

/** Default habit list for the tracking dashboard when user has none. */
export const DEFAULT_HABIT_DEFINITIONS: HabitDefinition[] = [
  { id: "habit-gym", label: "Gym" },
  { id: "habit-eat-clean", label: "Eat Clean" },
  { id: "habit-pray", label: "Pray" },
  { id: "habit-bed-23", label: "Bed Before 23:00" },
  { id: "habit-journal", label: "Journaling" },
  { id: "habit-screen-5h", label: "Screen Time - 5h" },
  { id: "habit-nofaps", label: "NoFaps" },
  { id: "habit-deep-work", label: "Deep Work" },
  { id: "habit-post-3x", label: "Post 3x" },
  { id: "habit-deep-learning", label: "Deep Learning" },
];
