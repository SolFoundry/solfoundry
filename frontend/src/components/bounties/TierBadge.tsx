import type { BountyTier } from '../../types/bounty';
import { bountyTierPillClass } from './bountyLabelTheme';

export function TierBadge({ tier }: { tier: BountyTier }) {
  return (
    <span className={bountyTierPillClass(tier) + ' font-bold'} data-testid={'tier-badge-' + tier}>
      {tier}
    </span>
  );
}
