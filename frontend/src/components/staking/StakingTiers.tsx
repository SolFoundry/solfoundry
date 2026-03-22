/**
 * StakingTiers — Visualization of $FNDRY staking tiers with reward rates.
 *
 * Renders a responsive grid of tier cards showing the minimum stake requirement,
 * APY percentage, and visual indicator for the user's current tier.
 * Each tier has a distinct color and icon to communicate the progression path.
 *
 * @module components/staking/StakingTiers
 */
import type { StakingTier } from '../../types/staking';
import { STAKING_TIERS } from '../../types/staking';

/** Props for the StakingTiers component. */
interface StakingTiersProps {
  /** The tier the user currently qualifies for based on staked amount. */
  currentTierId: string;
  /** Current staked amount to show progress toward next tier. */
  stakedAmount: number;
}

/**
 * Render a tier badge icon based on the tier's icon identifier.
 *
 * @param icon - Icon identifier from the StakingTier definition.
 * @param color - Hex color for the icon fill.
 * @returns SVG icon element.
 */
function TierIcon({ icon, color }: { icon: string; color: string }) {
  switch (icon) {
    case 'shield':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      );
    case 'star':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={0.5}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case 'crown':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={0.5}>
          <path d="M2 20h20v2H2v-2zm1-7l4 4 5-7 5 7 4-4v9H3v-9z" />
        </svg>
      );
    case 'diamond':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={0.5}>
          <path d="M12 2L2 12l10 10 10-10L12 2z" />
        </svg>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: color, opacity: 0.6 }} />
      );
  }
}

/**
 * Format a token amount for display (e.g., 500000 -> "500K").
 *
 * @param amount - Raw token amount.
 * @returns Formatted string with K/M suffix.
 */
function formatTokenAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toString();
}

/**
 * Calculate progress toward the next staking tier.
 *
 * @param stakedAmount - Current staked amount.
 * @param currentTier - The current tier object.
 * @returns Progress percentage (0-100) toward the next tier, or 100 if at max tier.
 */
function calculateTierProgress(stakedAmount: number, currentTier: StakingTier): number {
  const currentIndex = STAKING_TIERS.findIndex((t) => t.id === currentTier.id);
  if (currentIndex >= STAKING_TIERS.length - 1) return 100;
  const nextTier = STAKING_TIERS[currentIndex + 1];
  const range = nextTier.minimumStake - currentTier.minimumStake;
  if (range <= 0) return 100;
  return Math.min(100, Math.max(0, ((stakedAmount - currentTier.minimumStake) / range) * 100));
}

/**
 * StakingTiers — Responsive tier cards showing APY rates and user progress.
 *
 * Displays all available staking tiers in a grid layout. The user's current
 * tier is highlighted with a glowing border. Each card shows the minimum
 * stake, APY rate, and whether the tier is locked or active.
 */
export function StakingTiers({ currentTierId, stakedAmount }: StakingTiersProps) {
  const currentTier = STAKING_TIERS.find((t) => t.id === currentTierId) ?? STAKING_TIERS[0];
  const nextTierIndex = STAKING_TIERS.findIndex((t) => t.id === currentTierId) + 1;
  const nextTier = nextTierIndex < STAKING_TIERS.length ? STAKING_TIERS[nextTierIndex] : null;
  const progressToNext = calculateTierProgress(stakedAmount, currentTier);

  return (
    <div className="space-y-6" data-testid="staking-tiers">
      {/* Tier header with progress */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">Staking Tiers</h3>
        {nextTier && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>
              {formatTokenAmount(stakedAmount)} / {formatTokenAmount(nextTier.minimumStake)} to{' '}
              <span style={{ color: nextTier.color }}>{nextTier.name}</span>
            </span>
          </div>
        )}
      </div>

      {/* Progress bar toward next tier */}
      {nextTier && (
        <div className="w-full bg-surface-300 rounded-full h-2" role="progressbar" aria-valuenow={progressToNext} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress toward ${nextTier.name} tier`}>
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressToNext}%`, backgroundColor: nextTier.color }}
          />
        </div>
      )}

      {/* Tier cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAKING_TIERS.map((tier) => {
          const isActive = tier.id === currentTierId;
          const isLocked = tier.minimumStake > stakedAmount;
          return (
            <div
              key={tier.id}
              data-testid={`tier-card-${tier.id}`}
              className={`relative rounded-xl border p-4 transition-all duration-200 ${
                isActive
                  ? 'border-2 bg-surface-100 shadow-lg'
                  : isLocked
                    ? 'border-gray-800 bg-surface-50 opacity-60'
                    : 'border-gray-700 bg-surface-100'
              }`}
              style={isActive ? { borderColor: tier.color, boxShadow: `0 0 20px ${tier.color}30` } : undefined}
            >
              {/* Active badge */}
              {isActive && (
                <div
                  className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold text-black"
                  style={{ backgroundColor: tier.color }}
                >
                  ACTIVE
                </div>
              )}

              {/* Lock icon for locked tiers */}
              {isLocked && (
                <div className="absolute top-2 right-2 text-gray-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
              )}

              <div className="flex flex-col items-center text-center gap-3">
                <TierIcon icon={tier.icon} color={tier.color} />
                <div>
                  <h4 className="text-sm font-bold" style={{ color: tier.color }}>
                    {tier.name}
                  </h4>
                  <p className="text-2xl font-bold text-white mt-1">{tier.apyPercent}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">APY</p>
                </div>
                <div className="text-xs text-gray-500 border-t border-gray-800 pt-2 w-full">
                  {tier.minimumStake === 0
                    ? 'No minimum'
                    : `Min: ${formatTokenAmount(tier.minimumStake)} $FNDRY`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
