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
export function BountyCard({ bounty: b, onClick }: { bounty: Bounty; onClick: (id: string) => void }) {
  const [tr, setTr] = useState(() => formatTimeRemaining(b.deadline));
  useEffect(() => { const i = setInterval(() => setTr(formatTimeRemaining(b.deadline)), 6e4); return () => clearInterval(i); }, [b.deadline]);
  const exp = new Date(b.deadline).getTime() <= Date.now();
  const urg = b.status === 'open' && !exp && new Date(b.deadline).getTime() - Date.now() < 2 * 864e5;
  return (
    <button type="button" onClick={() => onClick(b.id)} className={'group relative w-full text-left rounded-xl border border-surface-300 bg-surface-50 hover:shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-solana-green' + (exp ? ' opacity-60' : '')} data-testid={'bounty-card-' + b.id} aria-label={'Bounty: ' + b.title + ', ' + b.rewardAmount + ' ' + b.currency}>
      {urg && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF6B6B] animate-pulse" />}
      <div className="p-5">
        <div className="flex justify-between mb-3"><TierBadge tier={b.tier} /><StatusIndicator status={b.status} /></div>
        <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-solana-green">{b.title}</h3>
        <p className="text-xs text-gray-500 mb-3">{b.projectName}</p>
        <div className="flex items-baseline gap-1 mb-3"><span className="text-lg font-bold text-solana-green">{formatReward(b.rewardAmount)}</span><span className="text-xs text-gray-500">{b.currency}</span></div>
        <SkillTags skills={b.skills} maxVisible={3} />
        <div className="flex justify-between pt-3 mt-3 border-t border-surface-300">
          <span className={'text-xs ' + (urg ? 'text-[#FF6B6B]' : 'text-gray-500')} data-testid="time-remaining">{tr}</span>
          <span className="text-xs text-gray-500">{b.submissionCount} submission{b.submissionCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </button>);
}
