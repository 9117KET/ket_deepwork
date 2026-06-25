import { Component } from "react"
import type { ReactNode, ErrorInfo } from "react"

interface Props {
  children: ReactNode
  /**
   * Custom fallback. When a function, it receives a `reset` callback so the
   * fallback can offer in-place recovery (clears the error and re-renders the
   * subtree) instead of forcing a full page reload.
   */
  fallback?: ReactNode | ((reset: () => void) => ReactNode)
  /**
   * When any value in this array changes, the boundary auto-clears its error.
   * Lets a localized crash recover when the user navigates / changes day, so a
   * transient render throw never sticks until a manual refresh.
   */
  resetKeys?: unknown[]
  /** Optional hook for logging / telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void
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
    this.props.onError?.(error, info)
  }

  componentDidUpdate(prevProps: Props) {
    // Auto-recover when the caller's reset keys change (e.g. route / selected day).
    if (this.state.error && prevProps.resetKeys && this.props.resetKeys) {
      const changed =
        prevProps.resetKeys.length !== this.props.resetKeys.length ||
        prevProps.resetKeys.some((k, i) => !Object.is(k, this.props.resetKeys![i]))
      if (changed) this.reset()
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      const { fallback } = this.props
      if (typeof fallback === "function") return fallback(this.reset)
      if (fallback !== undefined) return fallback
      return (
        <div className="flex min-h-screen items-center justify-center bg-share-bg p-8 text-center">
          <div className="max-w-md">
            <h1 className="mb-2 text-xl font-semibold text-share-onBg">Something went wrong</h1>
            <p className="mb-1 text-sm text-share-onSurfaceVariant">
              This part of the app hit an error. Your data is saved — try again without losing your place.
            </p>
            <p className="mb-6 font-mono text-xs text-share-onSurfaceVariant/40 break-all">
              {this.state.error.message.slice(0, 200)}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.reset}
                className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-share-onPrimary hover:bg-sky-400"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-md border border-share-outlineVariant/50 bg-share-surfaceContainerHigh px-4 py-2 text-sm font-medium text-share-onSurface hover:border-share-primary/50"
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
