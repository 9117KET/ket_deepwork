import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import "./index.css"
import App from "./App.tsx"
import { AuthProvider } from "./contexts/AuthContext"
import { convex } from "./lib/convex"
import { ErrorBoundary } from "./components/ErrorBoundary"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {/*
        Convex Auth reads any `?code=` in the URL as its own sign-in code.
        Google's calendar consent comes back to /calendar/callback with a
        `?code=` too; letting Convex Auth consume it fails ("Invalid
        verification code"), signs the user out, and the calendar callback
        then runs unauthenticated. That page owns its code.
      */}
      <ConvexAuthProvider
        client={convex}
        shouldHandleCode={() => !window.location.pathname.startsWith("/calendar/callback")}
      >
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </ConvexAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
