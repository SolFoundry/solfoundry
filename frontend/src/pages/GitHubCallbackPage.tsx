import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { exchangeGitHubCode } from '../api/auth';
import { setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';

export function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const didRun = useRef(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error || !code) {
      setAuthError('GitHub sign-in was cancelled or invalid. Please try again.');
      return;
    }

    exchangeGitHubCode(code, state ?? undefined)
      .then((response) => {
        // Store tokens + user in auth context
        const authUser = { ...response.user, wallet_verified: false };
        login(response.access_token, response.refresh_token ?? '', authUser);
        setAuthToken(response.access_token);
        // Store refresh token for future use
        if (response.refresh_token) {
          localStorage.setItem('sf_refresh_token', response.refresh_token);
        }
        navigate('/', { replace: true });
      })
      .catch(() => {
        setAuthError('GitHub sign-in failed during callback exchange. Please retry.');
      });
  }, []);

  if (authError) {
    return (
      <div className="min-h-screen bg-forge-950 flex items-center justify-center px-4">
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="max-w-md w-full rounded-xl border border-status-error/30 bg-forge-900 p-6 text-center"
        >
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-status-error/15 text-status-error">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary mb-2">Sign-in failed</h1>
          <p className="text-sm text-text-secondary mb-5">{authError}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
            >
              Back Home
            </button>
            <a
              href="/api/auth/github/authorize"
              className="px-4 py-2 rounded-lg bg-emerald text-text-inverse font-medium hover:bg-emerald-light transition-colors"
            >
              Try Again
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forge-950 flex items-center justify-center">
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="text-center"
      >
        <div className="w-12 h-12 rounded-full border-2 border-emerald border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-text-muted font-mono text-sm">Signing in with GitHub...</p>
      </motion.div>
    </div>
  );
}
