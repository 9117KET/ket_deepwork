/**
 * utils/tourStorage.ts
 *
 * Persists onboarding tour completion in localStorage so we can auto-show only on first visit.
 */

const STORAGE_KEY = 'ket_deepwork_tour_done'

export function getTourCompleted(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

export function setTourCompleted(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, '1')
}
