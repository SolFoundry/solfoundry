/**
 * StakingTiers — visual tier ladder showing all four tiers with requirements.
 */
import React from 'react';
import { TIER_CONFIGS } from '../../types/staking';
import type { StakingTier } from '../../types/staking';

interface StakingTiersProps {
  currentTier: StakingTier;
  stakedAmount: number;
  className?: string;
}

function formatFNDRY(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function StakingTiers({ currentTier, stakedAmount, className = '' }: StakingTiersProps) {
  return (
    <div className={`space-y-2 ${className}`} data-testid="staking-tiers">
      {TIER_CONFIGS.map((cfg) => {
        const isActive = currentTier === cfg.tier;
        const isUnlocked = stakedAmount >= cfg.minStake;
        const progress = Math.min(100, (stakedAmount / cfg.minStake) * 100);

        return (
          <div
            key={cfg.tier}
            className={`rounded-xl border p-4 transition-all ${
              isActive
                ? 'border-[#9945FF] bg-[#9945FF]/10'
                : isUnlocked
                  ? 'border-white/10 bg-white/5'
                  : 'border-white/5 bg-transparent opacity-50'
            }`}
            data-testid={`tier-${cfg.tier}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span
                  className="text-lg"
                  style={{ filter: isUnlocked ? 'none' : 'grayscale(1)' }}
                >
                  {cfg.tier === 'bronze' && '🥉'}
                  {cfg.tier === 'silver' && '🥈'}
                  {cfg.tier === 'gold' && '🥇'}
                  {cfg.tier === 'diamond' && '💎'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{cfg.label}</p>
                  <p className="text-xs text-gray-400">
                    {formatFNDRY(cfg.minStake)} $FNDRY minimum
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[#14F195]">{(cfg.apy * 100).toFixed(0)}% APY</p>
                <p className="text-xs text-gray-400">{cfg.repBoost}× rep boost</p>
              </div>
            </div>

            {!isUnlocked && stakedAmount > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{formatFNDRY(stakedAmount)} staked</span>
                  <span>{formatFNDRY(cfg.minStake - stakedAmount)} needed</span>
                </div>
                <div className="h-1 rounded-full bg-white/10">
                  <div
                    className={`h-1 rounded-full bg-gradient-to-r ${cfg.gradient}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {isActive && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-[#9945FF]/30 text-[#9945FF] font-medium">
                Current tier
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
