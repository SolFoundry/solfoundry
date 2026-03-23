import type { KeyboardEvent } from 'react';
import type { Bounty } from '../../types/bounty';
import { TierBadge } from './TierBadge';
import { StatusIndicator } from './StatusIndicator';
import { BountyTags } from './BountyTags';
import { formatTimeRemaining, formatReward } from './BountyCard';
import { TimeAgo } from '../common/TimeAgo';

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

  const activate = () => {
    if (b.githubIssueUrl) window.open(b.githubIssueUrl, '_blank', 'noopener,noreferrer');
    else onClick(b.id);
  };

  const onRowKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    activate();
  };

  return (
    <div
      onClick={activate}
      onKeyDown={onRowKeyDown}
      tabIndex={0}
      role="group"
      className="block w-full text-left rounded-lg focus-visible:ring-2 focus-visible:ring-solana-green focus-visible:outline-none cursor-pointer"
    >
      <div
        className={
          'flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-solana-green/40 transition-all dark:border-surface-300 dark:bg-surface-50' +
          (exp ? ' opacity-60' : '')
        }
      >
        <div className="flex items-center gap-2 shrink-0">
          <TierBadge tier={b.tier} />
          <CreatorBadgeInline type={b.creatorType || 'platform'} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{b.title}</h3>
          <div className="mt-1 space-y-1.5 min-w-0">
            <span className="text-xs text-gray-500">{b.projectName}</span>
            <BountyTags
              tier={b.tier}
              skills={b.skills}
              category={b.category}
              interactive
              showTier={false}
              maxSkills={4}
              data-testid={'bounty-tags-row-' + b.id}
            />
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
            <span className={'text-xs ' + (urg ? 'text-accent-red' : 'text-gray-500')}>
              {formatTimeRemaining(b.deadline)}
            </span>
          </div>
          <div className="w-16 text-center">
            {b.createdAt ? (
              <TimeAgo date={b.createdAt} className="text-[10px] text-gray-500" />
            ) : (
              <span className="text-[10px] text-gray-400">-</span>
            )}
          </div>
          <div className="w-20">
            <StatusIndicator status={b.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BountyListView({ bounties, onBountyClick }: { bounties: Bounty[]; onBountyClick: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2" data-testid="bounty-list">
      {bounties.map(b => <BountyRow key={b.id} bounty={b} onClick={onBountyClick} />)}
    </div>
  );
}
