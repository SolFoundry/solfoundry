import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { exchangeGitHubCode, consumeOAuthState } from '../api/auth';
import { setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';

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

    if (error) {
      console.error('GitHub OAuth error:', error);
      navigate('/?auth_error=' + encodeURIComponent(error), { replace: true });
      return;
    }

    if (!code) {
      navigate('/', { replace: true });
      return;
    }

    // Validate OAuth state for CSRF protection
    const expectedState = consumeOAuthState();
    if (expectedState && state !== expectedState) {
      console.error('GitHub OAuth state mismatch — possible CSRF attack');
      navigate('/?auth_error=state_mismatch', { replace: true });
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
      .catch((err) => {
        console.error('GitHub OAuth code exchange failed:', err);
        navigate('/?auth_error=exchange_failed', { replace: true });
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