/**
 * @fileoverview React error boundary for the extension popup UI.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { hasError: boolean; message: string | null }

/**
 * Catches React render errors in the popup so a bad state does not blank the UI silently.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[PromptBolt] Popup error', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-w-[320px] max-w-[400px] bg-bolt-void p-6 text-center text-zinc-300">
          <p className="font-display text-sm font-bold text-fuchsia-400">
            PromptBolt hit a snag
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {this.state.message ?? 'Something went wrong. Close and reopen the popup.'}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
