import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { exchangeGitHubCode } from '../api/auth';
import { setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  'oauth_authorization_declined': 'GitHub authorization was declined.',
  'oauth_error': 'GitHub OAuth encountered an error.',
  'token_exchange_failed': 'Failed to exchange authorization code for a session. Please try again.',
  'invalid_state': 'OAuth state mismatch. Possible CSRF attempt. Please try again.',
  'access_denied': 'GitHub access was denied.',
};

function getOAuthErrorMessage(error: string | null, errorDescription: string | null): string {
  if (errorDescription) return errorDescription;
  if (error && OAUTH_ERROR_MESSAGES[error]) return OAUTH_ERROR_MESSAGES[error];
  if (error) return `GitHub OAuth error: ${error}`;
  return 'Sign-in failed. Please try again.';
}

export function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const didRun = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // GitHub returned an error (e.g., user declined, or OAuth config problem)
    if (oauthError || !code) {
      const msg = getOAuthErrorMessage(oauthError, errorDescription);
      setError(msg);
      // Pass error to home page so user sees it there
      navigate(`/?oauth_error=${encodeURIComponent(msg)}`, { replace: true });
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
      .catch((err: Error) => {
        // Token exchange failed — this is the "404" bug in the bounty description.
        // Surface a helpful message so users aren't left guessing.
        const msg =
          err?.message?.includes('404')
            ? 'GitHub OAuth token exchange failed (404). The platform OAuth configuration may be misconfigured. Please contact support or try again later.'
            : err?.message
              ? `Sign-in failed: ${err.message}`
              : 'Sign-in failed during token exchange. Please try again.';
        setError(msg);
        navigate(`/?oauth_error=${encodeURIComponent(msg)}`, { replace: true });
      });
  }, []);

  return (
    <div className="min-h-screen bg-forge-950 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-center max-w-md px-6"
          >
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Sign-in Failed</h2>
            <p className="text-red-400 text-sm mb-6">{error}</p>
            <p className="text-text-muted text-xs mb-6">
              If this problem persists, please open an issue on GitHub or contact the SolFoundry
              team.
            </p>
            <a
              href="/"
              className="inline-block px-4 py-2 bg-emerald text-black font-semibold rounded hover:bg-emerald/90 transition-colors"
            >
              Back to Home
            </a>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-center"
          >
            <div className="w-12 h-12 rounded-full border-2 border-emerald border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-text-muted font-mono text-sm">Signing in with GitHub...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
