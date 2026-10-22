import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { exchangeGitHubCode } from '../api/auth';
import { setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';

type Status = 'loading' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You declined to authorize the app. Sign-in was cancelled.',
  bad_verification_code: 'The authorization code expired. Please try signing in again.',
  redirect_uri_mismatch: 'OAuth configuration error — please contact support.',
  state_mismatch: 'Security check failed (state mismatch). Please try signing in again.',
};

export function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const didRun = useRef(false);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      const friendly = ERROR_MESSAGES[error] ?? errorDescription ?? 'Sign-in failed. Please try again.';
      setErrorMessage(friendly);
      setStatus('error');
      return;
    }

    if (!code) {
      setErrorMessage('No authorization code received. Please try signing in again.');
      setStatus('error');
      return;
    }

    const savedState = sessionStorage.getItem('gh_oauth_state');
    if (savedState && state && savedState !== state) {
      sessionStorage.removeItem('gh_oauth_state');
      setErrorMessage(ERROR_MESSAGES.state_mismatch);
      setStatus('error');
      return;
    }
    sessionStorage.removeItem('gh_oauth_state');

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
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
        setErrorMessage(msg);
        setStatus('error');
      });
  }, []);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-forge-950 flex items-center justify-center px-4">
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          className="max-w-sm w-full text-center"
        >
          <div className="rounded-xl border border-status-error/30 bg-forge-900 p-8">
            <AlertCircle className="w-10 h-10 text-status-error mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-text-primary mb-2">
              Sign-in failed
            </h2>
            <p className="text-text-muted text-sm mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-emerald text-forge-950 font-semibold text-sm hover:bg-emerald/90 transition-colors duration-150"
            >
              Back to home
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
