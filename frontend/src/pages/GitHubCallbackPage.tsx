import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { exchangeGitHubCode } from '../api/auth';
import { setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';

/**
 * GitHubCallbackPage — handles the OAuth callback from GitHub.
 * Exchanges the authorization code for JWT tokens, validates CSRF state,
 * stores the session, and redirects to the home page.
 */
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

    if (error || !code) {
      navigate('/', { replace: true });
      return;
    }

    // Validate CSRF state
    const storedState = sessionStorage.getItem('oauth_state');
    if (state !== storedState) {
      console.error('[GitHubCallback] CSRF state mismatch — possible attack');
      sessionStorage.removeItem('oauth_state');
      navigate('/', { replace: true });
      return;
    }
    sessionStorage.removeItem('oauth_state');

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
        navigate('/', { replace: true });
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
        <div className="w-12 h-12 rounded-full border-2 border-emerald border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-text-muted font-mono text-sm">Signing in with GitHub...</p>
      </motion.div>
    </div>
  );
}
