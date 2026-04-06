import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { exchangeGitHubCode } from '../api/auth';
import { setAuthToken } from '../services/apiClient';
import { fadeIn } from '../lib/animations';
import { useToast } from '../contexts/ToastContext';

export function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { pushToast } = useToast();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error || !code) {
      pushToast({
        title: 'GitHub sign-in failed',
        description: error ? `GitHub returned: ${error}` : 'Missing OAuth code from GitHub callback.',
        variant: 'error',
      });
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
        pushToast({
          title: 'Signed in with GitHub',
          description: `Welcome back, ${authUser.username}.`,
          variant: 'success',
        });
        navigate('/', { replace: true });
      })
      .catch(() => {
        pushToast({
          title: 'GitHub sign-in failed',
          description: 'Could not complete the GitHub OAuth flow. Please try again.',
          variant: 'error',
        });
        navigate('/', { replace: true });
      });
  }, [login, navigate, pushToast, searchParams]);

  return (
    <div className="min-h-screen bg-forge-950 flex items-center justify-center">
      <motion.div variants={fadeIn} initial="initial" animate="animate" className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-emerald border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-text-muted font-mono text-sm">Signing in with GitHub...</p>
      </motion.div>
    </div>
  );
}
