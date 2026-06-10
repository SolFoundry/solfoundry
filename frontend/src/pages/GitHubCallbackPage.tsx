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
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam || !code) {
      navigate('/', { replace: true });
      return;
    }

    // Validate OAuth state for CSRF protection
    const savedState = sessionStorage.getItem('sf_oauth_state');
    sessionStorage.removeItem('sf_oauth_state');

    // When the backend handles the OAuth callback we may not have a stored state
    // Only enforce validation when state was stored (frontend-initiated flow)
    if (state && savedState && state !== savedState) {
      setError('Security validation failed. Please try signing in again.');
      return;
    }

    exchangeGitHubCode(code, state ?? undefined)
      .then((response) => {
        const authUser = { ...response.user, wallet_verified: false };
        login(response.access_token, response.refresh_token ?? '', authUser);
        setAuthToken(response.access_token);
        if (response.refresh_token) {
          localStorage.setItem('sf_refresh_token', response.refresh_token);
        }
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Authentication failed. Please try again.',
        );
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-forge-950 flex items-center justify-center px-4">
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="max-w-sm w-full text-center"
        >
          <div className="rounded-xl border border-border bg-forge-900 p-8">
            <AlertCircle className="w-10 h-10 text-status-error mx-auto mb-4" />
            <h2 className="font-sans text-lg font-semibold text-text-primary mb-2">
              Sign-In Failed
            </h2>
            <p className="text-text-muted text-sm mb-6">{error}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forge-800 text-text-secondary text-sm hover:bg-forge-700 transition-colors"
            >
              Go Home
            </button>
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
