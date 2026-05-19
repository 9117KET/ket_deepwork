import { Component } from "react"
import type { ReactNode, ErrorInfo } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack?.slice(0, 500))
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center">
          <div className="max-w-md">
            <h1 className="mb-2 text-xl font-semibold text-slate-100">Something went wrong</h1>
            <p className="mb-1 text-sm text-slate-400">
              A sync error occurred. This is usually temporary.
            </p>
            <p className="mb-6 font-mono text-xs text-slate-600 break-all">
              {this.state.error.message.slice(0, 200)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
            >
              Refresh page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
