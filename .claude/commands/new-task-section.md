# Add a New Task Section

Add a new named section to the day planner (alongside mustDo, morningRoutine, etc.).

## Files to update (in order)

### 1. `src/domain/types.ts`
Add the new ID to `TaskSectionId`:
```ts
export type TaskSectionId =
  | 'mustDo' | 'morningRoutine' | 'highPriority'
  | 'mediumPriority' | 'lowPriority' | 'nightRoutine'
  | '<newSectionId>'   // ← add here
```

Add a new entry to `FIXED_SECTIONS`:
```ts
{
  id: '<newSectionId>',
  label: '<Display Name>',
  placeholder: 'Add a task...',
  maxTasks: undefined, // or a number like 3 for mustDo
}
```

### 2. `src/domain/stats.ts`
Add a weight for the new section in `SECTION_WEIGHTS`:
```ts
const SECTION_WEIGHTS: Record<TaskSectionId, number> = {
  // existing...
  '<newSectionId>': 1, // adjust based on importance
}
```

### 3. `src/domain/sectionTimeBlocks.ts`
If the section has a time window, add it to the time blocks map. If it's time-independent, no change needed.

### 4. `src/components/tracking/MonthlyTrackingDashboard.tsx`
If section completion should appear in the monthly tracker, add the section to the list of tracked sections.

## Conventions
- Section IDs are camelCase strings, stable across migrations (stored in Supabase JSONB).
- `mustDo` is special: limited to 3 tasks (`maxTasks: 3`), highest weight (3).
- Routine sections (morning/night) have lower weights (1).
- Order in `FIXED_SECTIONS` determines render order in the planner UI.
- After adding, test with an existing planner day in localStorage to verify the section renders and tasks persist correctly.
