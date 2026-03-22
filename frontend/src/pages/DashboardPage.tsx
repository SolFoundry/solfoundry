/** Route entry point for /dashboard — Contributor Dashboard with On-Chain Event Feed.
 *
 * Renders the contributor dashboard alongside a real-time event feed
 * showing indexed Solana program events (escrow, reputation, staking).
 * The event feed uses WebSocket for live updates with REST polling fallback.
 */
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { ContributorDashboard } from '../components/ContributorDashboard';
import { EventFeed } from '../components/activity/EventFeed';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? undefined;

  return (
    <div className="space-y-6">
      <ContributorDashboard
        userId={walletAddress ?? 'anonymous'}
        walletAddress={walletAddress}
        onBrowseBounties={() => navigate('/bounties')}
        onViewLeaderboard={() => navigate('/leaderboard')}
        onCheckTreasury={() => navigate('/tokenomics')}
        onConnectAccount={() => {}}
        onDisconnectAccount={() => {}}
      />
      {/* Real-time on-chain event feed */}
      <EventFeed token={walletAddress} />
    </div>
  );
}
