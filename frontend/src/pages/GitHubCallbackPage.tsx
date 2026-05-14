import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import {
  clearGitHubOAuthState,
  exchangeGitHubCode,
  redirectToGitHubSignIn,
  validateGitHubOAuthState,
} from '../api/auth';
import { ApiError, setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';

function getSignInErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 401) {
      return 'That GitHub sign-in link expired. Please try again.';
    }
    if (error.status === 403 || error.status === 429) {
      return 'GitHub sign-in is temporarily rate limited. Please try again in a moment.';
    }
  }
  return 'Could not complete GitHub sign-in. Please try again.';
}

export function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const didRun = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const retrySignIn = () => {
    redirectToGitHubSignIn().catch(() => {
      setErrorMessage('GitHub sign-in is not configured. Please try again later.');
    });
  };

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      clearGitHubOAuthState();
      setErrorMessage('GitHub sign-in was cancelled or denied.');
      return;
    }

    if (!code) {
      clearGitHubOAuthState();
      setErrorMessage('Missing GitHub authorization code. Please try again.');
      return;
    }

    if (!validateGitHubOAuthState(state)) {
      setErrorMessage('GitHub sign-in session expired. Please try again.');
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
      .catch((caught: unknown) => {
        setErrorMessage(getSignInErrorMessage(caught));
      });
  }, []);

  return (
    <div className="min-h-screen bg-forge-950 flex items-center justify-center">
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="text-center"
      >
        {errorMessage ? (
          <div className="max-w-sm rounded-xl border border-border bg-forge-900 p-6">
            <p className="text-text-primary font-semibold mb-2">GitHub sign-in failed</p>
            <p className="text-text-muted text-sm mb-5">{errorMessage}</p>
            <button
              onClick={retrySignIn}
              className="px-4 py-2 rounded-lg bg-emerald text-forge-950 font-semibold text-sm hover:bg-emerald/90 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full border-2 border-emerald border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-text-muted font-mono text-sm">Signing in with GitHub...</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
