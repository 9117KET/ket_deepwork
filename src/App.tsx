/**
 * App.tsx
 *
 * Root application shell. The planner is the app: `/` opens today, and the
 * routes that used to host the landing page, travel, finance and sharing now
 * redirect there so old bookmarks still land somewhere useful.
 */

import { Navigate, Routes, Route, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PlannerPage } from "./pages/PlannerPage";
import { ReviewPage } from "./pages/ReviewPage";
import { CalendarSyncPage } from "./pages/CalendarSyncPage";
import { CalendarCallbackPage } from "./pages/CalendarCallbackPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { RestorePage } from "./pages/RestorePage";
import { ChallengePage } from "./pages/ChallengePage";
import { ChallengeJoinPage } from "./pages/ChallengeJoinPage";

function App() {
  const location = useLocation();

  return (
    // Top-level safety net: a render throw anywhere below shows a recoverable
    // card instead of blanking the whole app. Auto-resets when the route changes.
    <ErrorBoundary resetKeys={[location.pathname]}>
      <Routes>
        <Route path="/" element={<PlannerPage />} />
        <Route path="/planner" element={<Navigate to="/" replace />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/planner/review" element={<Navigate to="/review" replace />} />
        <Route path="/calendar" element={<CalendarSyncPage />} />
        <Route path="/calendar/callback" element={<CalendarCallbackPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/restore" element={<RestorePage />} />
        <Route path="/challenge" element={<ChallengePage />} />
        <Route path="/challenge/join" element={<ChallengeJoinPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
