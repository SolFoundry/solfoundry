/** ErrorBoundary — Catches render errors with retry. @module components/common/ErrorBoundary */
import React from 'react';

/** Class component required for getDerivedStateFromError. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(p: { children: React.ReactNode }) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, i: React.ErrorInfo) { console.error('[ErrorBoundary]', e, i.componentStack); }
  reset = () => { this.setState({ error: null }); };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8" role="alert">
        <p className="text-lg font-semibold text-white">Something went wrong</p>
        <p className="text-sm text-gray-400 text-center max-w-md">{this.state.error.message}</p>
        <button onClick={this.reset} className="px-4 py-2 rounded-lg bg-[#9945FF]/20 text-[#9945FF] hover:bg-[#9945FF]/30 text-sm">Try again</button>
      </div>
    );
  }
}
export default ErrorBoundary;
