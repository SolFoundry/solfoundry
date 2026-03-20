import type { Bounty } from '../../types/bounty';
import { BountyCard } from './BountyCard';
export function BountyGrid({ bounties, onBountyClick }: { bounties: Bounty[]; onBountyClick: (id: string) => void }) {
  return (<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="bounty-grid">{bounties.map(b => <BountyCard key={b.id} bounty={b} onClick={onBountyClick} />)}</div>);
}
