/** Route entry point for /dashboard — Contributor Dashboard */
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthContext } from '../contexts/AuthContext';
import { ContributorDashboard } from '../components/ContributorDashboard';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { user } = useAuthContext();
  const walletAddress = publicKey?.toBase58() ?? undefined;
  // Use GitHub username if linked, otherwise wallet address for leaderboard lookups
  const userId = user?.username ?? walletAddress ?? undefined;

  return (
    <ContributorDashboard
      userId={userId}
      walletAddress={walletAddress}
      githubUsername={user?.github_id ? user.username : undefined}
      onBrowseBounties={() => navigate('/bounties')}
      onViewLeaderboard={() => navigate('/leaderboard')}
      onCheckTreasury={() => navigate('/tokenomics')}
      onConnectAccount={(type) => {
        if (type === 'github') {
          const clientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GITHUB_CLIENT_ID) || '';
          if (!clientId) { navigate('/settings'); return; }
          const state = crypto.randomUUID();
          sessionStorage.setItem('github_link_state', state);
          const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: `${window.location.origin}/auth/github/callback`,
            scope: 'read:user',
            state,
          });
          window.location.href = `https://github.com/login/oauth/authorize?${params}`;
        }
      }}
      onDisconnectAccount={() => {}}
    />
  );
}
