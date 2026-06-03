const SESSION_KEY = {
  weekly: 'review_reminder_dismissed_weekly',
  monthly: 'review_reminder_dismissed_monthly',
} as const

export function isReviewReminderDismissed(type: 'weekly' | 'monthly'): boolean {
  try {
    return Boolean(sessionStorage.getItem(SESSION_KEY[type]))
  } catch {
    return false
  }
}

export function dismissReviewReminder(type: 'weekly' | 'monthly'): void {
  try {
    sessionStorage.setItem(SESSION_KEY[type], '1')
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}
