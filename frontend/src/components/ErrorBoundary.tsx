/**
 * ErrorBoundary — React error boundary that catches render errors gracefully.
 *
 * Shows a friendly error page with:
 *  - A short error summary
 *  - "Try again" button (resets boundary state)
 *  - "Go home" button (navigates to /)
 *  - "Report issue" link (opens GitHub issue tracker)
 *
 * Matches site dark/light theme. Can be used as a top-level wrapper
 * or scoped around individual sections.
 *
 * @module components/ErrorBoundary
 */
import React from 'react';
import { SolFoundryLogoMark } from './common/SolFoundryLogoMark';

/** GitHub issues URL for the "Report issue" link. */
const REPORT_URL = 'https://github.com/SolFoundry/solfoundry/issues/new?labels=bug&template=bug_report.md';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback (overrides the default error UI). */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  eventId: string | null;
}

/**
 * ErrorBoundary component — wraps children and displays a recovery UI if a
 * React render error is thrown anywhere in the tree.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, eventId: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log for observability — swap for a real error tracking SDK as needed
    console.error('[ErrorBoundary] Uncaught render error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null, eventId: null });
  };

  render() {
    const { error, eventId } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;

    if (fallback) return fallback;

    return (
      <ErrorPage
        error={error}
        eventId={eventId}
        onRetry={this.handleRetry}
      />
    );
  }
}

// ── Standalone error page (also exported for use as a route-level error UI) ──

export interface ErrorPageProps {
  error?: Error | null;
  /** Optional error event ID (e.g. from Sentry) shown to aid support. */
  eventId?: string | null;
  onRetry?: () => void;
}

/**
 * ErrorPage — full-page error display. Used as the ErrorBoundary fallback and
 * can also be rendered directly on an /error route.
 */
export function ErrorPage({ error, eventId, onRetry }: ErrorPageProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-16 text-center"
      role="alert"
      aria-live="assertive"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <SolFoundryLogoMark size="lg" className="shadow-lg shadow-solana-purple/20" />
        <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          SolFoundry
        </span>
      </div>

      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6" aria-hidden="true">
        <svg
          className="w-10 h-10 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>

      {/* Headline */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Something went wrong
      </h1>

      {/* Error message */}
      {error?.message && (
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-2 font-mono bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2">
          {error.message}
        </p>
      )}

      {eventId && (
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
          Error ID: <code className="font-mono">{eventId}</code>
        </p>
      )}

      <p className="text-gray-600 dark:text-gray-400 text-sm max-w-sm mb-10">
        An unexpected error occurred. You can try again, go home, or let us
        know if this keeps happening.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-2.5 rounded-lg bg-solana-purple text-white font-semibold text-sm
                       hover:bg-violet-700 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-solana-purple focus:ring-offset-2
                       focus:ring-offset-white dark:focus:ring-offset-black"
          >
            Try again
          </button>
        )}
        <a
          href="/"
          className="px-6 py-2.5 rounded-lg border border-gray-300 bg-gray-100 text-gray-800 font-medium text-sm
                     hover:bg-gray-200 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                     focus:ring-offset-white dark:border-transparent dark:bg-white/10 dark:text-gray-300
                     dark:hover:bg-white/20 dark:focus:ring-white/30 dark:focus:ring-offset-black"
        >
          Go home
        </a>
        <a
          href={REPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-solana-purple hover:text-violet-500 underline underline-offset-2 transition-colors"
        >
          Report issue ↗
        </a>
      </div>
    </div>
  );
}

export default ErrorBoundary;
