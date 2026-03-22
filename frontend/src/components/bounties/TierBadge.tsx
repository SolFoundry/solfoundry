import type { BountyTier } from '../../types/bounty';
const S: Record<BountyTier, string> = {
  T1: 'bg-solana-green/15 text-solana-green',
  T2: 'bg-accent-gold/15 text-accent-gold',
  T3: 'bg-accent-red/15 text-accent-red',
};
export function TierBadge({ tier }: { tier: BountyTier }) {
  return <span className={'inline-flex rounded-md px-2 py-0.5 text-xs font-bold ' + S[tier]} data-testid={'tier-badge-' + tier}>{tier}</span>;
}
