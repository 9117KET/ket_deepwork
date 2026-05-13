import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import "./index.css"
import App from "./App.tsx"
import { AuthProvider } from "./contexts/AuthContext"
import { convex } from "./lib/convex"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>,
)
