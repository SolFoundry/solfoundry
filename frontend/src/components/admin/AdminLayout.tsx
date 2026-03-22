/**
 * AdminLayout — sidebar + header shell for all admin panels.
 *
 * Auth gate: prompts GitHub OAuth sign-in. After OAuth, the JWT is stored in
 * sessionStorage under sf_admin_token and used as a Bearer token for all
 * admin API requests.
 *
 * WebSocket: passes an onEvent handler that invalidates React Query caches
 * for the relevant keys so panels update in real time without polling.
 */
import { useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminWebSocket, type AdminWsEvent } from '../../hooks/useAdminWebSocket';
import { getAdminToken, setAdminToken, clearAdminToken } from '../../hooks/useAdminData';
import type { AdminSection } from '../../types/admin';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface NavItem {
  id: AdminSection;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',      label: 'Overview'        },
  { id: 'bounties',      label: 'Bounties'         },
  { id: 'contributors',  label: 'Contributors'     },
  { id: 'reviews',       label: 'Review Pipeline'  },
  { id: 'financial',     label: 'Financial'        },
  { id: 'health',        label: 'System Health'    },
  { id: 'audit-log',     label: 'Audit Log'        },
];

interface Props {
  active: AdminSection;
  onNavigate: (s: AdminSection) => void;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Auth gate — GitHub OAuth primary, API key fallback
// ---------------------------------------------------------------------------

function AdminLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  /** Redirect to GitHub OAuth — on return the token lands via URL param. */
  const handleGitHubLogin = () => {
    // Generate a cryptographically random CSRF state token and persist it so
    // AdminPage can verify it matches the value echoed back by the OAuth callback.
    const stateBytes = new Uint8Array(16);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('sf_admin_oauth_state', state);
    window.location.href = `${API_BASE}/api/auth/github/authorize?state=${state}`;
  };

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) { setError('API key is required'); return; }
    setAdminToken(key.trim());
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 space-y-5">
        <div className="text-center">
          <span className="text-3xl font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
            SolFoundry
          </span>
          <p className="mt-1 text-xs text-gray-500 uppercase tracking-widest">Admin Dashboard</p>
        </div>

        {!showKeyForm ? (
          <>
            <button
              onClick={handleGitHubLogin}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
              data-testid="admin-github-login-btn"
            >
              {/* GitHub icon */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
              </svg>
              Sign in with GitHub
            </button>

            <div className="text-center">
              <button
                onClick={() => setShowKeyForm(true)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                data-testid="admin-use-apikey-link"
              >
                Use API key instead
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleKeySubmit} className="space-y-4" data-testid="admin-login-form">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5" htmlFor="admin-key">
                Admin API Key
              </label>
              <input
                id="admin-key"
                type="password"
                value={key}
                onChange={e => { setKey(e.target.value); setError(''); }}
                placeholder="Enter admin API key…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9945FF]/50"
                autoComplete="current-password"
                data-testid="admin-key-input"
              />
              {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              data-testid="admin-login-btn"
            >
              Sign In
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowKeyForm(false)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Back to GitHub login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout shell
// ---------------------------------------------------------------------------

// WS event type → React Query key mapping for cache invalidation
const WS_EVENT_INVALIDATIONS: Record<string, string[][]> = {
  bounty_claimed:     [['admin', 'bounties'], ['admin', 'overview']],
  bounty_created:     [['admin', 'bounties'], ['admin', 'overview']],
  bounty_updated:     [['admin', 'bounties']],
  bounty_closed:      [['admin', 'bounties'], ['admin', 'overview']],
  pr_submitted:       [['admin', 'reviews'], ['admin', 'overview']],
  review_complete:    [['admin', 'reviews']],
  admin_action:       [['admin', 'audit-log']],
  contributor_banned: [['admin', 'contributors'], ['admin', 'overview']],
  payout_completed:   [['admin', 'financial'], ['admin', 'overview']],
};

export function AdminLayout({ active, onNavigate, children }: Props) {
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const queryClient = useQueryClient();

  // Invalidate relevant queries on real-time WS events
  const handleWsEvent = useCallback(
    (event: AdminWsEvent) => {
      const keys = WS_EVENT_INVALIDATIONS[event.type];
      if (keys) {
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      } else {
        // Unknown event: refresh overview + audit log conservatively
        queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-log'] });
      }
    },
    [queryClient],
  );

  const { status: wsStatus } = useAdminWebSocket(handleWsEvent);

  if (!authed) {
    return <AdminLoginForm onSuccess={() => setAuthed(true)} />;
  }

  const wsColor =
    wsStatus === 'connected'  ? 'bg-[#14F195]' :
    wsStatus === 'connecting' ? 'bg-yellow-400' :
    wsStatus === 'error'      ? 'bg-red-500'    : 'bg-gray-600';

  const handleSignOut = () => {
    clearAdminToken();
    setAuthed(false);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a14] text-white font-mono" data-testid="admin-layout">

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <span className="text-sm font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
            SolFoundry
          </span>
          <span className="ml-2 text-[10px] text-gray-600 uppercase tracking-widest">Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2" aria-label="Admin navigation">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={
                'w-full text-left flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors ' +
                (active === item.id
                  ? 'bg-[#9945FF]/15 text-[#9945FF]'
                  : 'text-gray-500 hover:text-white hover:bg-white/5')
              }
              aria-current={active === item.id ? 'page' : undefined}
              data-testid={`admin-nav-${item.id}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/5 space-y-2">
          {/* WS status */}
          <div className="flex items-center gap-2 text-[10px] text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${wsColor}`} />
            <span>
              {wsStatus === 'connected'  ? 'Live' :
               wsStatus === 'connecting' ? 'Connecting…' : 'Offline'}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-[10px] text-gray-600 hover:text-white transition-colors"
            data-testid="admin-signout"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
