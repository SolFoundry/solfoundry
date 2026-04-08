import React, { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { exchangeGitHubCode, getGitHubAuthorizeEndpoint } from '../api/auth';
import { ApiError, setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';

type CallbackStatus = 'loading' | 'error';

function getOAuthErrorMessage(error: string | null): string {
  switch (error) {
    case 'access_denied':
      return 'GitHub authorization was cancelled. Please try again.';
    case 'invalid_request':
      return 'Invalid GitHub OAuth request. Please retry sign-in.';
    default:
      return 'GitHub sign-in failed. Please try again.';
  }
}

function getExchangeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Invalid or expired GitHub code. Please try signing in again.';
    if (error.status === 401) return 'GitHub sign-in was rejected due to an invalid state/session. Please retry.';
    if (error.status === 429) return 'GitHub sign-in is rate limited right now. Please wait and retry.';
    if (error.status >= 500) return 'Authentication service is temporarily unavailable. Please retry shortly.';
    return error.message || 'GitHub sign-in failed. Please try again.';
  }

  return 'Network error during GitHub sign-in. Please check your connection and retry.';
}

export function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const didRun = useRef(false);
  const [status, setStatus] = React.useState<CallbackStatus>('loading');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error || !code) {
      setStatus('error');
      setErrorMessage(error ? getOAuthErrorMessage(error) : 'Missing OAuth code from GitHub callback. Please retry sign-in.');
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
      .catch((error) => {
        setStatus('error');
        setErrorMessage(getExchangeErrorMessage(error));
      });
  }, []);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-forge-950 flex items-center justify-center px-4">
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="w-full max-w-md rounded-xl border border-border bg-forge-900 p-6 text-center"
        >
          <h1 className="text-text-primary font-display text-xl mb-2">GitHub sign-in failed</h1>
          <p className="text-text-muted text-sm leading-relaxed mb-6">{errorMessage}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={getGitHubAuthorizeEndpoint()}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald text-forge-950 font-semibold text-sm hover:bg-emerald/90 transition-colors"
            >
              Try again
            </a>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-hover text-sm transition-colors"
            >
              Go home
            </Link>
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
