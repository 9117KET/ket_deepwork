# New Page / Route

Scaffold a new page and wire it into the router.

## Steps

1. Ask the user: page name (PascalCase, e.g. `HabitsPage`), route path (e.g. `/habits`), and a one-line description.
2. Create `src/pages/<PageName>.tsx` using the template below.
3. Add the route to `src/App.tsx` inside the existing `<Routes>` block.
4. Add a nav link in `src/components/layout/AppMobileNav.tsx` and `src/components/layout/AppTopBar.tsx` if the page should appear in navigation.

## Page template

```tsx
import { useAuth } from '../contexts/AuthContext'

export default function <PageName>() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-background text-white px-4 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6"><Page Title></h1>
      {/* page content */}
    </div>
  )
}
```

## Route entry to add in App.tsx

```tsx
import <PageName> from './pages/<PageName>'
// inside <Routes>:
<Route path="/<path>" element={<<PageName> />} />
```

## Project conventions

- Pages live in `src/pages/`, named `<Feature>Page.tsx`.
- Use `useAuth()` from `src/contexts/AuthContext` for user state — do NOT read from Supabase directly in a page.
- State and persistence go in `src/storage/localStorageState.ts` via `usePersistentState()`, or a dedicated storage module in `src/storage/`.
- Pure business logic (no React) belongs in `src/domain/`.
- Styling uses Tailwind utility classes. Background: `bg-background` (#050509), surfaces: `bg-gray-900` / `bg-gray-800`, accent: `text-sky-400` / `bg-sky-500`.
- Material Icons are available via `<MaterialIcon name="icon_name" />` from `src/components/ui/MaterialIcon`.
