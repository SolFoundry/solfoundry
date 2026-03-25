/**
 * GitHubCallbackPage -- handles the OAuth callback after GitHub authorization.
 * Exchanges the code with the backend to link the GitHub account to the wallet.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

export default function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken: token, updateUser } = useAuthContext();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = sessionStorage.getItem('github_link_state');

    if (!code) {
      setStatus('error');
      setErrorMsg('No authorization code received from GitHub.');
      return;
    }

    if (state !== savedState) {
      setStatus('error');
      setErrorMsg('State mismatch. Please try linking again.');
      return;
    }

    sessionStorage.removeItem('github_link_state');

    (async () => {
      try {
        const res = await fetch('/api/users/me/link-github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        });

        if (res.ok) {
          const linkData = await res.json().catch(() => ({}));
          // Update auth context with new GitHub username + avatar
          if (linkData.github_username) {
            updateUser({
              username: linkData.github_username,
              github_id: linkData.github_username,
            });
          }
          setStatus('success');
          setTimeout(() => navigate('/settings', { replace: true }), 2000);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setErrorMsg(data.detail || 'Failed to link GitHub account.');
        }
      } catch {
        setStatus('error');
        setErrorMsg('Network error. Please try again.');
      }
    })();
  }, [searchParams, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="max-w-md w-full mx-4 rounded-xl border border-white/10 bg-surface-100 p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin w-8 h-8 border-2 border-solana-purple border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white">Linking GitHub account...</h2>
            <p className="text-sm text-gray-400 mt-2">Please wait while we verify your GitHub account.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-lg font-semibold text-white">GitHub linked</h2>
            <p className="text-sm text-gray-400 mt-2">Your GitHub account is now connected. Redirecting to your profile...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-lg font-semibold text-white">Linking failed</h2>
            <p className="text-sm text-red-400 mt-2">{errorMsg}</p>
            <button
              onClick={() => navigate('/settings', { replace: true })}
              className="mt-4 px-6 py-2 bg-solana-purple hover:bg-solana-purple/80 text-white rounded-lg text-sm transition-colors min-h-[44px]"
            >
              Back to Profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}
