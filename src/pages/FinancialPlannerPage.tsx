/**
 * pages/FinancialPlannerPage.tsx
 *
 * Financial Planner -- coming soon.
 */

import { AppChrome } from "../components/layout/AppChrome";
import { ComingSoonBanner } from "../components/ui/ComingSoonBanner";

export function FinancialPlannerPage() {
  return (
    <AppChrome headerPositionClass="top-0" mobileActive="finance" maxWidthClass="max-w-[1600px]">
      <ComingSoonBanner feature="Financial Planner" />
    </AppChrome>
  );
}
