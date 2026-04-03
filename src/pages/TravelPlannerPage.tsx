/**
 * pages/TravelPlannerPage.tsx
 *
 * Travel Planner -- coming soon.
 */

import { AppChrome } from "../components/layout/AppChrome";
import { ComingSoonBanner } from "../components/ui/ComingSoonBanner";

export function TravelPlannerPage() {
  return (
    <AppChrome headerPositionClass="top-0" mobileActive="travel" maxWidthClass="max-w-7xl">
      <ComingSoonBanner feature="Travel Planner" />
    </AppChrome>
  );
}
