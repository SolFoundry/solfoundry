/** Route entry point for /dashboard — Contributor Dashboard */
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { ContributorDashboard } from '../components/ContributorDashboard';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? undefined;

  return (
    <ContributorDashboard
      userId={walletAddress ?? 'anonymous'}
      walletAddress={walletAddress}
      onBrowseBounties={() => navigate('/bounties')}
      onViewLeaderboard={() => navigate('/leaderboard')}
      onCheckTreasury={() => navigate('/tokenomics')}
      onStakeFndry={() => navigate('/staking')}
      onConnectAccount={() => {}}
      onDisconnectAccount={() => {}}
    />
  );
}
