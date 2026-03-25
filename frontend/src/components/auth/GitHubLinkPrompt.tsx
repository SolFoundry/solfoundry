/**
 * GitHubLinkPrompt -- shown after wallet connect if the user has no GitHub linked.
 * Prompts them to link their GitHub account for submitting to bounties.
 */
import React, { useState } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const GITHUB_REDIRECT_URI = `${window.location.origin}/auth/github/callback`;

interface GitHubLinkPromptProps {
  onDismiss?: () => void;
}

export function GitHubLinkPrompt({ onDismiss }: GitHubLinkPromptProps) {
  const { user } = useAuthContext();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already linked or dismissed
  if (!user || user.github_id || dismissed) return null;

  const handleLink = () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem('github_link_state', state);
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: GITHUB_REDIRECT_URI,
      scope: 'read:user',
      state,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="mx-auto max-w-xl mt-4 rounded-lg border border-solana-purple/30 bg-surface-100 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-2xl">🔗</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">Link your GitHub account</h3>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">
            Connect your GitHub to submit solutions to bounties, build your reputation, and showcase your work.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleLink}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 transition-colors min-h-[44px]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Connect GitHub
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors min-h-[44px] px-2"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
