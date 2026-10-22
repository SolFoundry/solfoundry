import { useCallback, useState } from 'react';
import { getGitHubAuthorizeUrl } from '../api/auth';

/**
 * useGitHubSignIn
 *
 * Handles the full GitHub OAuth redirect:
 * 1. Generate a CSRF state token and store it in sessionStorage.
 * 2. Ask the backend for the authorize URL (preferred — backend sets client_id, scope).
 * 3. If the backend call fails, build the URL client-side as a fallback.
 * 4. Redirect the browser to GitHub.
 *
 * Returns { signIn, isLoading, error } so callers can show a spinner / error.
 */
export function useGitHubSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Generate and persist a CSRF state token
    const state = crypto.randomUUID();
    sessionStorage.setItem('gh_oauth_state', state);

    try {
      // Preferred: let the backend build the URL (has client_id, scope, redirect_uri)
      const url = await getGitHubAuthorizeUrl();
      if (url && url.startsWith('https://')) {
        window.location.href = url;
        return;
      }
      // Backend returned something unusable — fall through to direct redirect
    } catch {
      // Backend unavailable — fall through to direct redirect
    }

    // Fallback: redirect directly to the backend OAuth endpoint
    // The backend will redirect to GitHub from there
    window.location.href = `/api/auth/github/authorize?state=${state}`;
  }, []);

  return { signIn, isLoading, error };
}
