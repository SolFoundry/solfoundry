import type { BountyTier } from '../../types/bounty';
const S: Record<BountyTier, string> = { T1: 'bg-[#14F195]/15 text-[#14F195]', T2: 'bg-[#FFD700]/15 text-[#FFD700]', T3: 'bg-[#FF6B6B]/15 text-[#FF6B6B]' };
export function TierBadge({ tier }: { tier: BountyTier }) {
  return <span className={'inline-flex rounded-md px-2 py-0.5 text-xs font-bold ' + S[tier]} data-testid={'tier-badge-' + tier}>{tier}</span>;
}
