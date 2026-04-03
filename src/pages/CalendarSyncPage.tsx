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
      headerPositionClass="top-0"
      mobileActive="planner"
      maxWidthClass="max-w-4xl"
      showCalendarLink
    >
      <ComingSoonBanner feature="Google Calendar Sync" />
    </AppChrome>
  );
}
