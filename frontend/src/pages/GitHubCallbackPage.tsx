import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { exchangeGitHubCode } from '../api/auth';
import { ApiError, setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';
import { setOAuthFlashMessage } from '../lib/oauthFlash';

export function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      const msg =
        errorDescription?.replace(/\+/g, ' ') ||
        (error === 'access_denied' ? 'GitHub sign-in was cancelled.' : 'GitHub sign-in failed.');
      setOAuthFlashMessage(msg, 'error');
      navigate('/', { replace: true });
      return;
    }

    if (!code) {
      setOAuthFlashMessage('Missing authorization code. Start sign-in again.', 'info');
      navigate('/', { replace: true });
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
        setOAuthFlashMessage(`Signed in as ${response.user.username}`, 'success');
        navigate('/', { replace: true });
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Could not complete sign-in. The code may have expired — try again.';
        setOAuthFlashMessage(msg, 'error');
        navigate('/', { replace: true });
      });
  }, [login, navigate, searchParams]);

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
