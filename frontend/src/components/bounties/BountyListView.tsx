import type { Bounty } from '../../types/bounty';
import { TierBadge } from './TierBadge';
import { StatusIndicator } from './StatusIndicator';
import { formatTimeRemaining, formatReward } from './BountyCard';

function CreatorBadgeInline({ type }: { type: 'platform' | 'community' }) {
  if (type === 'platform') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-solana-purple/15 px-1.5 py-0.5 text-[10px] font-medium text-solana-purple">
        <svg className="h-2 w-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        Official
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-solana-green/10 px-1.5 py-0.5 text-[10px] font-medium text-solana-green/70">
      Community
    </span>
  );
}

function BountyRow({ bounty: b, onClick }: { bounty: Bounty; onClick: (id: string) => void }) {
  const exp = new Date(b.deadline).getTime() <= Date.now();
  const urg = b.status === 'open' && !exp && new Date(b.deadline).getTime() - Date.now() < 2 * 864e5;

  const row = (
    <div className={'flex items-center gap-4 px-4 py-3 rounded-lg border border-surface-300 bg-surface-50 hover:border-solana-green/40 transition-all' + (exp ? ' opacity-60' : '')}>
      <div className="flex items-center gap-2 shrink-0">
        <TierBadge tier={b.tier} />
        <CreatorBadgeInline type={b.creatorType || 'platform'} />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-white truncate">{b.title}</h3>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-500">{b.projectName}</span>
          <div className="flex flex-wrap gap-1">
            {b.skills.slice(0, 3).map(s => (
              <span key={s} className="rounded-full bg-surface-200 px-1.5 py-0.5 text-[10px] text-gray-400">{s}</span>
            ))}
            {b.skills.length > 3 && <span className="text-[10px] text-gray-500">+{b.skills.length - 3}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0 text-right">
        <div>
          <span className="text-sm font-bold text-solana-green">{formatReward(b.rewardAmount)}</span>
          <span className="text-[10px] text-gray-500 ml-1">{b.currency}</span>
        </div>
        <div className="w-16 text-center">
          <span className="text-xs text-gray-500">{b.submissionCount}</span>
          <p className="text-[10px] text-gray-600">subs</p>
        </div>
        <div className="w-20 text-center">
          <span className={'text-xs ' + (urg ? 'text-[#FF6B6B]' : 'text-gray-500')}>
            {formatTimeRemaining(b.deadline)}
          </span>
        </div>
        <div className="w-20">
          <StatusIndicator status={b.status} />
        </div>
      </div>
    </div>
  );

  if (b.githubIssueUrl) {
    return (
      <a href={b.githubIssueUrl} target="_blank" rel="noopener noreferrer" className="block">
        {row}
      </a>
    );
  }

  return (
    <button type="button" onClick={() => onClick(b.id)} className="block w-full text-left focus-visible:ring-2 focus-visible:ring-solana-green rounded-lg">
      {row}
    </button>
  );
}

export function BountyListView({ bounties, onBountyClick }: { bounties: Bounty[]; onBountyClick: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2" data-testid="bounty-list">
      {bounties.map(b => <BountyRow key={b.id} bounty={b} onClick={onBountyClick} />)}
    </div>
  );
}
