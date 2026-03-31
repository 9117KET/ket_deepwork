/** Shared Tailwind class helpers used across pages. */

export function appCardClass() {
  return "rounded-xl border border-share-outlineVariant/20 bg-share-surfaceContainerLow p-6";
}

export function appInputClass() {
  return "mt-1 w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainer px-3 py-2 text-share-onSurface placeholder:text-share-onSurfaceVariant/70 focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary";
}

export function appPrimaryButtonClass() {
  return "rounded-lg bg-share-primary px-4 py-2 text-sm font-bold text-share-onPrimary transition-all hover:bg-share-primaryContainer disabled:opacity-60";
}

export function appSecondaryButtonClass() {
  return "rounded-lg border border-share-outlineVariant/50 bg-share-surfaceContainerHigh px-4 py-2 text-sm font-medium text-share-onSurface transition-colors hover:border-share-outlineVariant disabled:opacity-60";
}
