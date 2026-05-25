/**
 * pages/CalendarSyncPage.tsx
 *
 * Google Calendar Sync -- coming soon.
 */

import { AppChrome } from "../components/layout/AppChrome";
import { ComingSoonBanner } from "../components/ui/ComingSoonBanner";

export function CalendarSyncPage() {
  return (
    <AppChrome
      mobileActive="planner"
      showCalendarLink
    >
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 pb-28 md:pb-10">
        <ComingSoonBanner feature="Google Calendar Sync" />
      </div>
    </AppChrome>
  );
}
