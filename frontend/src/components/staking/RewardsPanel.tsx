/**
 * RewardsPanel — shows accrued rewards with a claim button.
 */
import React from 'react';

interface RewardsPanelProps {
  rewardsAvailable: number;
  rewardsEarned: number;
  apy: number;
  onClaim: () => void;
  isClaiming: boolean;
  disabled?: boolean;
  className?: string;
}

export function RewardsPanel({
  rewardsAvailable,
  rewardsEarned,
  apy,
  onClaim,
  isClaiming,
  disabled = false,
  className = '',
}: RewardsPanelProps) {
  const canClaim = rewardsAvailable > 0 && !disabled;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 ${className}`}
      data-testid="rewards-panel"
    >
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Rewards</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[#14F195]/5 border border-[#14F195]/20 p-3">
          <p className="text-xs text-gray-400 mb-1">Available to claim</p>
          <p className="text-xl font-bold text-[#14F195]">
            {rewardsAvailable.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </p>
          <p className="text-xs text-gray-500">$FNDRY</p>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/5 p-3">
          <p className="text-xs text-gray-400 mb-1">Total earned (lifetime)</p>
          <p className="text-xl font-bold text-white">
            {rewardsEarned.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </p>
          <p className="text-xs text-gray-500">$FNDRY</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          Current APY:{' '}
          <span className="text-[#14F195] font-semibold">{(apy * 100).toFixed(0)}%</span>
        </span>
        <button
          onClick={onClaim}
          disabled={!canClaim || isClaiming}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[#14F195]/15 text-[#14F195] hover:bg-[#14F195]/25 disabled:hover:bg-[#14F195]/15"
          data-testid="claim-btn"
        >
          {isClaiming ? 'Claiming...' : 'Claim rewards'}
        </button>
      </div>
    </div>
  );
}
