/**
 * StakingDashboard — main staking UI orchestrating position, tiers, rewards, history, and modal.
 */
import React, { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useFndryBalance } from '../../hooks/useFndryToken';
import { useStakingTx } from '../../hooks/useStaking';
import {
  useStakingPosition,
  useStakingHistory,
  useStakingStats,
  useRecordStake,
  useInitiateUnstake,
  useCompleteUnstake,
  useClaimRewards,
} from '../../hooks/useStakingData';
import { StakingTiers } from './StakingTiers';
import { RewardsPanel } from './RewardsPanel';
import { StakingHistory } from './StakingHistory';
import { StakingModal } from './StakingModal';
import { CooldownTimer } from './CooldownTimer';
import type { StakeModalMode } from '../../types/staking';

export function StakingDashboard() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const { balance: walletBalance, refetch: refetchBalance } = useFndryBalance();
  const { transaction, stakeTokens, unstakeTokens, reset: resetTx } = useStakingTx();

  const positionQuery = useStakingPosition(wallet);
  const position = positionQuery.data ?? null;

  const [historyPage, setHistoryPage] = useState(1);
  const historyQuery = useStakingHistory(wallet, 10, (historyPage - 1) * 10);

  const statsQuery = useStakingStats();
  const stats = statsQuery.data;

  const recordStake = useRecordStake(wallet ?? '');
  const initiateUnstake = useInitiateUnstake(wallet ?? '');
  const completeUnstake = useCompleteUnstake(wallet ?? '');
  const claimRewards = useClaimRewards(wallet ?? '');

  const [modal, setModal] = useState<StakeModalMode | null>(null);

  const openModal = useCallback((mode: StakeModalMode) => {
    resetTx();
    setModal(mode);
  }, [resetTx]);

  const closeModal = useCallback(() => {
    setModal(null);
    resetTx();
    positionQuery.refetch();
    refetchBalance();
  }, [resetTx, positionQuery, refetchBalance]);

  const handleStake = useCallback(
    async (amount: number) => {
      const sig = await stakeTokens(amount);
      await recordStake.mutateAsync({ amount, signature: sig });
    },
    [stakeTokens, recordStake],
  );

  const handleInitiateUnstake = useCallback(
    async (amount: number) => {
      const sig = await unstakeTokens(amount);
      await initiateUnstake.mutateAsync(amount);
    },
    [unstakeTokens, initiateUnstake],
  );

  const handleCompleteUnstake = useCallback(async () => {
    const sig = await unstakeTokens(0);
    await completeUnstake.mutateAsync(sig);
  }, [unstakeTokens, completeUnstake]);

  const handleClaim = useCallback(async () => {
    await claimRewards.mutateAsync();
  }, [claimRewards]);

  if (!wallet) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 gap-4"
        data-testid="staking-connect-prompt"
      >
        <p className="text-4xl">🔒</p>
        <p className="text-lg font-semibold text-white">Connect your wallet to stake</p>
        <p className="text-sm text-gray-400">
          Stake $FNDRY to earn APY rewards and boost your reputation score.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="staking-dashboard">
      {/* Position summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Staked</p>
          <p className="text-2xl font-bold text-white">
            {(position?.staked_amount ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">$FNDRY</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Tier</p>
          <p className="text-2xl font-bold text-[#9945FF] capitalize">
            {position?.tier ?? 'None'}
          </p>
          <p className="text-xs text-gray-500">
            {position?.rep_boost ? `${position.rep_boost}× rep boost` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Wallet balance</p>
          <p className="text-2xl font-bold text-white">
            {walletBalance !== null ? walletBalance.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-gray-500">$FNDRY</p>
        </div>
      </div>

      {/* Cooldown notice */}
      {position?.cooldown_active && position.cooldown_ends_at && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-400">Cooldown in progress</p>
            <p className="text-xs text-gray-400">
              {position.unstake_amount.toLocaleString()} $FNDRY queued for unstaking
            </p>
          </div>
          <CooldownTimer endsAt={position.cooldown_ends_at} />
        </div>
      )}

      {/* Ready to unstake banner */}
      {position?.unstake_ready && (
        <div className="rounded-xl border border-[#14F195]/20 bg-[#14F195]/5 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-[#14F195]">Cooldown complete!</p>
            <p className="text-xs text-gray-400">
              {position.unstake_amount.toLocaleString()} $FNDRY ready to withdraw
            </p>
          </div>
          <button
            onClick={() => openModal('unstake')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#14F195]/15 text-[#14F195] hover:bg-[#14F195]/25"
          >
            Complete unstake
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => openModal('stake')}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#9945FF] text-white hover:bg-[#9945FF]/90 transition-all"
          data-testid="stake-btn"
        >
          Stake $FNDRY
        </button>
        {position && position.staked_amount > 0 && !position.cooldown_active && !position.unstake_ready && (
          <button
            onClick={() => openModal('unstake')}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-all"
            data-testid="unstake-btn"
          >
            Unstake
          </button>
        )}
      </div>

      {/* Rewards + Tiers side by side on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RewardsPanel
          rewardsAvailable={position?.rewards_available ?? 0}
          rewardsEarned={position?.rewards_earned ?? 0}
          apy={position?.apy ?? 0}
          onClaim={() => openModal('claim')}
          isClaiming={claimRewards.isPending}
          disabled={!position || position.staked_amount <= 0}
        />
        <StakingTiers
          currentTier={position?.tier ?? 'none'}
          stakedAmount={position?.staked_amount ?? 0}
        />
      </div>

      {/* Global stats */}
      {stats && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Total staked</p>
            <p className="text-base font-bold text-white">
              {stats.total_staked.toLocaleString(undefined, { maximumFractionDigits: 0 })} $FNDRY
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Stakers</p>
            <p className="text-base font-bold text-white">{stats.total_stakers.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Rewards paid</p>
            <p className="text-base font-bold text-[#14F195]">
              {stats.total_rewards_paid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Avg APY</p>
            <p className="text-base font-bold text-[#9945FF]">
              {(stats.avg_apy * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* History */}
      <StakingHistory
        items={historyQuery.data?.items ?? []}
        total={historyQuery.data?.total ?? 0}
        page={historyPage}
        onPageChange={setHistoryPage}
        perPage={10}
        loading={historyQuery.isLoading}
      />

      {/* Modal */}
      {modal && (
        <StakingModal
          mode={modal}
          position={position}
          walletBalance={walletBalance}
          transaction={transaction}
          onStake={handleStake}
          onInitiateUnstake={handleInitiateUnstake}
          onCompleteUnstake={handleCompleteUnstake}
          onClaim={handleClaim}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
