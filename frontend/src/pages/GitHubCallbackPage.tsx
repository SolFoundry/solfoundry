import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function GitHubCallbackPage() {
  const navigate = useNavigate();
  const { handleCallback } = useAuth();

  useEffect(() => {
    async function processCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        if (error) {
          console.error('OAuth error:', error);
          // Redirect to home with error
          navigate('/?auth_error=' + encodeURIComponent(error));
          return;
        }

        if (!code) {
          console.error('No code in callback');
          navigate('/?auth_error=no_code');
          return;
        }

        // Validate state to prevent CSRF
        const savedState = sessionStorage.getItem('oauth_state');
        if (state && savedState && state !== savedState) {
          console.error('State mismatch');
          navigate('/?auth_error=state_mismatch');
          return;
        }

        // Exchange code for token
        const success = await handleCallback(code);
        if (success) {
          sessionStorage.removeItem('oauth_state');
          const redirectTo = sessionStorage.getItem('auth_redirect') || '/';
          sessionStorage.removeItem('auth_redirect');
          navigate(redirectTo);
        } else {
          navigate('/?auth_error=callback_failed');
        }
      } catch (err) {
        console.error('Callback error:', err);
        navigate('/?auth_error=unknown');
      }
    }

    processCallback();
  }, [handleCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-950">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-muted">Completing sign in...</p>
      </div>
    </div>
  );
}