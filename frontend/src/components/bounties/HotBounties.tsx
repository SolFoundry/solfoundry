import type { Bounty } from '../../types/bounty';
import { BountyCard } from './BountyCard';

export function HotBounties({ bounties }: { bounties: Bounty[] }) {
  return (
    <section className="mt-6 mb-2" data-testid="hot-bounties">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full bg-accent-red animate-pulse" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wide uppercase">Hot Bounties</h2>
        <span className="text-xs text-gray-500">Highest activity in last 24h</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {bounties.map(b => (
          <BountyCard key={b.id} bounty={b} onClick={id => { window.location.href = '/bounties/' + id; }} />
        ))}
      </div>
    </section>
  );
}
