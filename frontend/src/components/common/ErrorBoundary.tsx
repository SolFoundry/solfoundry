import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  message?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable ErrorBoundary component to catch rendering errors and provide
 * a consistent recovery UI with retry and home navigation actions.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={`flex flex-col items-center justify-center p-8 text-center min-h-[300px] bg-[#1a1a1a]/50 rounded-2xl border border-red-500/20 ${this.props.className}`}>
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500">
            <AlertCircle size={32} />
          </div>
          
          <h2 className="text-2xl font-bold mb-2 text-white">Something went wrong</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            {this.props.message ||'There was an unexpected error while loading this component. Please try again or return home.'}
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={18} />
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-6 py-2 bg-white/5 text-white rounded-lg font-bold hover:bg-white/10 transition-colors border border-white/10"
            >
              <Home size={18} />
              Go Home
            </button>
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-8 p-4 bg-black/30 rounded-lg text-left w-full overflow-auto max-h-40">
              <p className="text-red-400 font-mono text-xs mb-2">Error Details (Dev Only):</p>
              <pre className="text-red-300 font-mono text-xs whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
