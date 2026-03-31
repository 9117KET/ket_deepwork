# New Component

Scaffold a new React component following project conventions.

## Steps

1. Ask the user: component name (PascalCase), which directory it belongs in (`planner/`, `timer/`, `tracking/`, `layout/`, `ui/`, or top-level `components/`), and what it does.
2. Create `src/components/<dir>/<ComponentName>.tsx` using the template below.
3. If the component needs to be exported from a barrel file (e.g. `tracking/index.ts`), add the export there.

## Component template

```tsx
interface <ComponentName>Props {
  // define props here
}

export default function <ComponentName>({ }: <ComponentName>Props) {
  return (
    <div>
      {/* component content */}
    </div>
  )
}
```

## Project conventions

- Props interfaces are defined inline at the top of the file, named `<ComponentName>Props`.
- Use `useAuth()` from `src/contexts/AuthContext` if auth state is needed.
- State that needs to persist goes up to `usePersistentState()` in `src/storage/localStorageState.ts` — components receive data and callbacks as props.
- Task mutation callbacks follow this pattern: `onAddTask`, `onUpdateTask`, `onDeleteTask`, `onToggleTask` — mirror what `DayPlanner.tsx` already exposes.
- Drag-and-drop uses native HTML5 drag events (no library). See `SectionColumn.tsx` for the pattern.
- Tailwind dark theme tokens: `bg-background`, `bg-gray-900`, `bg-gray-800`, `text-gray-400`, `text-sky-400`.
- Icons: `<MaterialIcon name="..." className="..." />` from `src/components/ui/MaterialIcon`.
- Do NOT use `window.prompt()` for new UI — use inline editing patterns (see `TaskItem.tsx`).
- Shared/view-mode: if the component participates in the shared planner, accept a `shareMode?: 'view' | 'edit'` prop and render no-op callbacks when `shareMode === 'view'`.
