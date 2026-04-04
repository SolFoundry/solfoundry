import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getGitHubAuthorizeUrl } from '../../api/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forge-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const handleSignIn = async () => {
      try {
        const url = await getGitHubAuthorizeUrl();
        window.location.href = url;
      } catch {
        // fallback: redirect to backend OAuth endpoint directly
        window.location.href = '/api/auth/github/authorize';
      }
    };

    return (
      <div className="min-h-screen bg-forge-950 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="rounded-xl border border-border bg-forge-900 p-8">
            <GitBranch className="w-10 h-10 text-text-muted mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-text-primary mb-2">
              Sign in to continue
            </h2>
            <p className="text-text-muted text-sm mb-6">
              Sign in with GitHub to continue
              {location.pathname !== '/' && (
                <span className="block mt-1 font-mono text-xs text-text-muted/70">
                  {location.pathname}
                </span>
              )}
            </p>
            <button
              onClick={handleSignIn}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald text-forge-950 font-semibold text-sm hover:bg-emerald/90 transition-colors duration-150"
            >
              <GitBranch className="w-4 h-4" />
              Sign in with GitHub
            </button>
            <Link
              to="/"
              className="mt-4 block text-sm text-text-muted hover:text-text-secondary transition-colors duration-150"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
