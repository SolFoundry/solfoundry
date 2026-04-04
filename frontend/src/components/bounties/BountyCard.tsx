import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, GitPullRequest } from 'lucide-react';
import type { Bounty } from '../../types/bounty';

export function formatTimeRemaining(deadline: string | null | undefined): string {
  if (!deadline) return 'No deadline';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 36e5);
  const days = Math.floor(diff / 864e5);
  if (days >= 1) return `${days}d left`;
  return `${hours}h left`;
}

export function formatReward(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return String(amount);
}

function isUrgent(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  const diff = new Date(deadline).getTime() - Date.now();
  return diff > 0 && diff < 24 * 36e5;
}

const TIER_STYLES: Record<string, string> = {
  T1: 'bg-tier-t1/10 text-tier-t1 border border-tier-t1/20',
  T2: 'bg-tier-t2/10 text-tier-t2 border border-tier-t2/20',
  T3: 'bg-tier-t3/10 text-tier-t3 border border-tier-t3/20',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_review: 'In Review',
  funded: 'Funded',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'text-emerald',
  in_review: 'text-magenta',
  funded: 'text-status-info',
  completed: 'text-text-muted',
  cancelled: 'text-status-error',
};

interface BountyCardProps {
  bounty: Bounty;
  onClick: (id: string) => void;
}

export function BountyCard({ bounty, onClick }: BountyCardProps) {
  const rewardAmt = bounty.rewardAmount ?? bounty.reward_amount ?? 0;
  const subCount = bounty.submissionCount ?? bounty.submission_count ?? 0;
  const timeStr = formatTimeRemaining(bounty.deadline);
  const expired = timeStr === 'Expired';
  const urgent = isUrgent(bounty.deadline);

  return (
    <Link
      to={`/bounties/${bounty.id}`}
      data-testid={`bounty-card-${bounty.id}`}
      onClick={(e) => {
        e.preventDefault();
        onClick(bounty.id);
      }}
      className="block rounded-xl border border-border bg-forge-900 p-5 hover:border-border-hover transition-colors cursor-pointer"
    >
      {/* Tier + Creator badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIER_STYLES[bounty.tier] ?? TIER_STYLES.T1}`}
        >
          {bounty.tier}
        </span>
        {bounty.creatorType && (
          <span
            data-testid={`creator-badge-${bounty.creatorType}`}
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              bounty.creatorType === 'platform'
                ? 'bg-emerald/10 text-emerald'
                : 'bg-purple/10 text-purple'
            }`}
          >
            {bounty.creatorType === 'platform' ? 'Official' : 'Community'}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-sans text-base font-semibold text-text-primary leading-snug line-clamp-2 mb-2">
        {bounty.title}
      </h3>

      {/* Skills */}
      {(bounty.skills?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {bounty.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 text-xs rounded-md bg-forge-800 text-text-muted border border-border"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-border/50 my-3" />

      {/* Reward + Meta */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg font-semibold text-emerald">
          {formatReward(rewardAmt)} {bounty.currency ?? bounty.reward_token ?? 'USDC'}
        </span>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <GitPullRequest className="w-3.5 h-3.5" />
            {subCount} submissions
          </span>
          {bounty.deadline && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {expired ? (
                <span className="text-status-error">Expired</span>
              ) : urgent ? (
                <span data-testid="urgent-indicator" className="text-status-warning">
                  {timeStr}
                </span>
              ) : (
                timeStr
              )}
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="mt-2">
        <span className={`text-xs font-medium ${STATUS_COLOR[bounty.status] ?? 'text-emerald'}`}>
          {STATUS_LABEL[bounty.status] ?? 'Open'}
        </span>
      </div>
    </Link>
  );
}
