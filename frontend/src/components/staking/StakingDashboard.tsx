/**
 * StakingDashboard — Main staking interface for $FNDRY token staking.
 *
 * Assembles all staking sub-components into a unified dashboard view:
 * - Staked amount, rewards earned, and APY estimate cards
 * - Staking tier visualization with progress
 * - Cooldown timer for active unstaking periods
 * - Claim rewards button with transaction confirmation
 * - Staking history table
 * - Stake/unstake modal triggered from action buttons
 * - Real-time balance updates via polling
 * - Platform-wide staking statistics
 *
 * Integrates with the Solana wallet adapter for transaction signing
 * and provides full error handling for all transaction states.
 *
 * @module components/staking/StakingDashboard
 */
import { useState, useCallback, useEffect } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import {
  useStakingPosition,
  useStakingHistory,
  useStakingStats,
  useStakingMutations,
  useWalletBalance,
} from '../../hooks/useStaking';
import { calculateEstimatedRewards } from '../../types/staking';
import { StakingTiers } from './StakingTiers';
import { CooldownTimer } from './CooldownTimer';
import { ClaimRewardsButton } from './ClaimRewardsButton';
import { StakingHistory } from './StakingHistory';
import { StakeUnstakeModal } from './StakeUnstakeModal';

/** Format a token amount with comma separators. */
function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US');
}

/**
 * StakingDashboard — Complete staking interface page component.
 *
 * Renders all staking functionality in a responsive layout:
 * - Top stats cards: staked amount, pending rewards, APY, tier
 * - Tier visualization and progress
 * - Cooldown timer (when active)
 * - Action buttons: Stake, Unstake, Claim Rewards
 * - Staking history table
 * - Platform statistics footer
 *
 * All data is fetched via custom hooks that attempt live API calls
 * and fall back to mock data for development.
 */
export function StakingDashboard() {
  const { publicKey, connected } = useSolanaWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  /* Data hooks */
  const position = useStakingPosition();
  const history = useStakingHistory();
  const stats = useStakingStats();
  const balance = useWalletBalance();
  const mutations = useStakingMutations();

  /* Modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultTab, setModalDefaultTab] = useState<'stake' | 'unstake'>('stake');

  /** Open the stake/unstake modal on a specific tab. */
  const openModal = useCallback((tab: 'stake' | 'unstake') => {
    setModalDefaultTab(tab);
    setModalOpen(true);
  }, []);

  /** Close the modal and refresh data. */
  const closeModal = useCallback(() => {
    setModalOpen(false);
    /* Refresh all data after a transaction */
    position.refetch();
    history.refetch();
    stats.refetch();
    balance.refetch();
  }, [position, history, stats, balance]);

  /* Real-time balance updates: poll every 30 seconds when connected */
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      position.refetch();
      balance.refetch();
    }, 30_000);
    return () => clearInterval(interval);
  }, [connected, position, balance]);

  const positionData = position.data;
  const historyData = history.data ?? [];
  const statsData = stats.data;

  const estimatedAnnualReward = positionData
    ? calculateEstimatedRewards(positionData.stakedAmount, positionData.currentApyPercent)
    : 0;

  /* Wallet not connected state */
  if (!connected || !walletAddress) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Connect Wallet to Stake</h1>
          <p className="text-gray-400 max-w-md mx-auto">
            Connect your Solana wallet to stake $FNDRY tokens, earn rewards, and boost your reputation score on SolFoundry.
          </p>
        </div>

        {/* Show platform stats even when disconnected */}
        {statsData && <PlatformStats stats={statsData} />}
        <StakingTiers currentTierId="bronze" stakedAmount={0} />
      </div>
    );
  }

  /* Loading state */
  if (position.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400 font-mono">Loading staking data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" data-testid="staking-dashboard">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            <span className="text-[#14F195]">$FNDRY</span> Staking
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Stake tokens to earn rewards and boost your SolFoundry reputation.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openModal('stake')}
            className="rounded-lg bg-[#14F195] px-4 py-2 text-sm font-semibold text-black hover:bg-[#14F195]/90 transition-colors shadow-lg shadow-[#14F195]/20"
            data-testid="stake-button"
          >
            Stake $FNDRY
          </button>
          <button
            type="button"
            onClick={() => openModal('unstake')}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
            data-testid="unstake-button"
            disabled={!positionData || positionData.stakedAmount <= 0}
          >
            Unstake
          </button>
        </div>
      </div>

      {/* Stats cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Staked Amount */}
        <div className="rounded-xl border border-gray-800 bg-surface-50 p-5" data-testid="stat-staked-amount">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Staked Amount</p>
          <p className="text-2xl font-bold text-white mt-2 font-mono">
            {positionData ? formatAmount(positionData.stakedAmount) : '0'}
          </p>
          <p className="text-xs text-gray-500 mt-1">$FNDRY</p>
        </div>

        {/* Pending Rewards */}
        <div className="rounded-xl border border-gray-800 bg-surface-50 p-5" data-testid="stat-pending-rewards">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Pending Rewards</p>
          <p className="text-2xl font-bold text-[#14F195] mt-2 font-mono">
            {positionData ? formatAmount(positionData.pendingRewards) : '0'}
          </p>
          <p className="text-xs text-gray-500 mt-1">$FNDRY earned</p>
        </div>

        {/* Current APY */}
        <div className="rounded-xl border border-gray-800 bg-surface-50 p-5" data-testid="stat-current-apy">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Current APY</p>
          <p className="text-2xl font-bold text-[#9945FF] mt-2">
            {positionData ? `${positionData.currentApyPercent}%` : '5%'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Est. {formatAmount(estimatedAnnualReward)} $FNDRY/yr
          </p>
        </div>

        {/* Current Tier */}
        <div className="rounded-xl border border-gray-800 bg-surface-50 p-5" data-testid="stat-current-tier">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Current Tier</p>
          <p className="text-2xl font-bold mt-2" style={{ color: positionData?.currentTier.color ?? '#CD7F32' }}>
            {positionData?.currentTier.name ?? 'Bronze'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {positionData?.stakedSince
              ? `Since ${new Date(positionData.stakedSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : 'Not staking yet'}
          </p>
        </div>
      </div>

      {/* Cooldown timer */}
      {positionData?.cooldownActive && (
        <CooldownTimer
          cooldownEndsAt={positionData.cooldownEndsAt}
          cooldownAmount={positionData.cooldownAmount}
        />
      )}

      {/* Claim rewards */}
      <ClaimRewardsButton
        pendingRewards={positionData?.pendingRewards ?? 0}
        walletConnected={connected}
        transactionStatus={mutations.transactionStatus}
        transactionError={mutations.transactionError}
        lastSignature={mutations.lastSignature}
        onClaim={mutations.claimRewards}
        onResetTransaction={mutations.resetTransaction}
      />

      {/* Staking tiers visualization */}
      <StakingTiers
        currentTierId={positionData?.currentTier.id ?? 'bronze'}
        stakedAmount={positionData?.stakedAmount ?? 0}
      />

      {/* Staking history */}
      <StakingHistory entries={historyData} isLoading={history.isLoading} />

      {/* Platform statistics */}
      {statsData && <PlatformStats stats={statsData} />}

      {/* Stake/Unstake Modal */}
      <StakeUnstakeModal
        open={modalOpen}
        onClose={closeModal}
        availableBalance={balance.availableBalance}
        stakedBalance={positionData?.stakedAmount ?? 0}
        currentApyPercent={positionData?.currentApyPercent ?? 5}
        transactionStatus={mutations.transactionStatus}
        transactionError={mutations.transactionError}
        lastSignature={mutations.lastSignature}
        onStake={mutations.stake}
        onUnstake={mutations.unstake}
        onResetTransaction={mutations.resetTransaction}
        defaultTab={modalDefaultTab}
      />
    </div>
  );
}

// ── Platform Stats Sub-component ────────────────────────────────────────────

import type { StakingStats } from '../../types/staking';

/** Props for the PlatformStats component. */
interface PlatformStatsProps {
  /** Platform-wide staking statistics. */
  stats: StakingStats;
}

/**
 * PlatformStats — Aggregate staking statistics displayed as a footer bar.
 *
 * Shows total staked, total stakers, average APY, and total rewards distributed.
 * Visible to all users regardless of wallet connection state.
 */
function PlatformStats({ stats }: PlatformStatsProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-surface-50 p-5" data-testid="platform-stats">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Platform Staking Stats</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500">Total Staked</p>
          <p className="text-lg font-bold text-white font-mono">{formatAmount(stats.totalStaked)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Active Stakers</p>
          <p className="text-lg font-bold text-white font-mono">{formatAmount(stats.totalStakers)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Average APY</p>
          <p className="text-lg font-bold text-[#9945FF]">{stats.averageApyPercent}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Rewards Distributed</p>
          <p className="text-lg font-bold text-[#14F195] font-mono">{formatAmount(stats.totalRewardsDistributed)}</p>
        </div>
      </div>
    </div>
  );
}
