import { useState, useEffect } from 'react';
import type { Bounty } from '../../types/bounty';
import { TierBadge } from './TierBadge';
import { StatusIndicator } from './StatusIndicator';
import { SkillTags } from './SkillTags';
export function formatTimeRemaining(dl: string): string {
  const d = new Date(dl).getTime() - Date.now();
  if (d <= 0) return 'Expired';
  const days = Math.floor(d / 864e5), hrs = Math.floor((d % 864e5) / 36e5);
  if (days > 0) return days + 'd ' + hrs + 'h left';
  const m = Math.floor((d % 36e5) / 6e4);
  return hrs > 0 ? hrs + 'h ' + m + 'm left' : m + 'm left';
}
export function formatReward(a: number): string { return a >= 1000 ? (a / 1000).toFixed(a % 1000 === 0 ? 0 : 1) + 'k' : '' + a; }

function CreatorBadge({ type }: { type: 'platform' | 'community' }) {
  if (type === 'platform') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-solana-purple/15 px-2 py-0.5 text-[10px] font-medium text-solana-purple"
        data-testid="creator-badge-platform"
      >
        <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        Official
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-solana-green/10 px-2 py-0.5 text-[10px] font-medium text-solana-green/70"
      data-testid="creator-badge-community"
    >
      Community
    </span>
  );
}

export function BountyCard({ bounty: b, onClick }: { bounty: Bounty; onClick: (id: string) => void }) {
  const [tr, setTr] = useState(() => formatTimeRemaining(b.deadline));
  useEffect(() => { const i = setInterval(() => setTr(formatTimeRemaining(b.deadline)), 6e4); return () => clearInterval(i); }, [b.deadline]);
  const exp = new Date(b.deadline).getTime() <= Date.now();
  const urg = b.status === 'open' && !exp && new Date(b.deadline).getTime() - Date.now() < 2 * 864e5;

  const cardContent = (
    <>
      {urg && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF6B6B] animate-pulse" data-testid="urgent-indicator" />}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TierBadge tier={b.tier} />
            <CreatorBadge type={b.creatorType || 'platform'} />
          </div>
          <StatusIndicator status={b.status} />
        </div>
        <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-solana-green">{b.title}</h3>
        <p className="text-xs text-gray-500 mb-3">{b.projectName}</p>
        <div className="flex items-baseline gap-1 mb-3"><span className="text-lg font-bold text-solana-green">{formatReward(b.rewardAmount)}</span><span className="text-xs text-gray-500">{b.currency}</span></div>
        <SkillTags skills={b.skills} maxVisible={3} />
        <div className="flex justify-between pt-3 mt-3 border-t border-surface-300">
          <span className={'text-xs ' + (urg ? 'text-[#FF6B6B]' : 'text-gray-500')} data-testid="time-remaining">{tr}</span>
          <span className="text-xs text-gray-500">{b.submissionCount} submission{b.submissionCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </>
  );

  // If there's a GitHub issue URL, render as a link that opens in new tab
  if (b.githubIssueUrl) {
    return (
      <a
        href={b.githubIssueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={'group relative w-full text-left rounded-xl border border-surface-300 bg-surface-50 hover:shadow-lg hover:border-solana-green/40 transition-all block' + (exp ? ' opacity-60' : '')}
        data-testid={'bounty-card-' + b.id}
        aria-label={'Bounty: ' + b.title + ', ' + b.rewardAmount + ' ' + b.currency}
      >
        {cardContent}
      </a>
    );
  }

  // Fallback: button with onClick
  return (
    <button
      type="button"
      onClick={() => onClick(b.id)}
      className={'group relative w-full text-left rounded-xl border border-surface-300 bg-surface-50 hover:shadow-lg hover:border-solana-green/40 transition-all focus-visible:ring-2 focus-visible:ring-solana-green' + (exp ? ' opacity-60' : '')}
      data-testid={'bounty-card-' + b.id}
      aria-label={'Bounty: ' + b.title + ', ' + b.rewardAmount + ' ' + b.currency}
    >
      {cardContent}
    </button>
  );
}
