/**
 * domain/promptTitle.ts
 *
 * What a task title prompt adds. A cancelled `window.prompt` returns null, and
 * cancel means "add nothing": it used to be read as the prefilled title, so
 * every cancel left a task called "New task" behind.
 */

/** The trimmed title to add, or null when nothing should be added. */
export function titleFromPrompt(raw: string | null): string | null {
  if (raw == null) return null
  const title = raw.trim()
  return title === '' ? null : title
}
