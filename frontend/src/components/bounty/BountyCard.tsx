import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitPullRequest, Clock } from 'lucide-react';
import type { Bounty } from '../../types/bounty';
import { cardHover } from '../../lib/animations';
import { timeLeft, formatCurrency, LANG_COLORS } from '../../lib/utils';

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    T1: 'bg-tier-t1/10 text-tier-t1 border border-tier-t1/20',
    T2: 'bg-tier-t2/10 text-tier-t2 border border-tier-t2/20',
    T3: 'bg-tier-t3/10 text-tier-t3 border border-tier-t3/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[tier] ?? styles.T1}`}>
      {tier}
    </span>
  );
}

interface BountyCardProps {
  bounty: Bounty;
}

export function BountyCard({ bounty }: BountyCardProps) {
  const navigate = useNavigate();

  const orgName = bounty.org_name ?? bounty.github_issue_url?.split('/')[3] ?? 'unknown';
  const repoName = bounty.repo_name ?? bounty.github_issue_url?.split('/')[4] ?? 'repo';
  const issueNumber = bounty.issue_number ?? bounty.github_issue_url?.split('/').pop();
  const skills = bounty.skills?.slice(0, 3) ?? [];

  const statusLabel = {
    open: 'Open',
    in_review: 'In Review',
    funded: 'Funded',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[bounty.status] ?? 'Open';

  const statusColor = {
    open: 'text-emerald',
    in_review: 'text-magenta',
    funded: 'text-status-info',
    completed: 'text-text-muted',
    cancelled: 'text-status-error',
  }[bounty.status] ?? 'text-emerald';

  const dotColor = {
    open: 'bg-emerald',
    in_review: 'bg-magenta',
    funded: 'bg-status-info',
    completed: 'bg-text-muted',
    cancelled: 'bg-status-error',
  }[bounty.status] ?? 'bg-emerald';

  const openBounty = () => navigate(`/bounties/${bounty.id}`);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openBounty();
    }
  };

  return (
    <motion.div
      variants={cardHover}
      initial="rest"
      whileHover="hover"
      onClick={openBounty}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Open bounty ${bounty.title}`}
      className="relative min-w-0 w-full rounded-lg sm:rounded-xl border border-border bg-forge-900 p-4 sm:p-5 cursor-pointer transition-colors duration-200 overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/60"
    >
      {/* Row 1: Repo + Tier */}
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {bounty.org_avatar_url && (
            <img src={bounty.org_avatar_url} className="w-5 h-5 rounded-full flex-shrink-0" alt="" />
          )}
          <span className="min-w-0 break-all font-mono text-xs text-text-muted sm:truncate">
            {orgName}/{repoName}
            {issueNumber && <span className="ml-1">#{issueNumber}</span>}
          </span>
        </div>
        <TierBadge tier={bounty.tier ?? 'T1'} />
      </div>

      {/* Row 2: Title */}
      <h3 className="mt-3 break-words font-sans text-base font-semibold text-text-primary leading-snug line-clamp-2">
        {bounty.title}
      </h3>

      {/* Row 3: Language dots */}
      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {skills.map((lang) => (
            <span key={lang} className="inline-flex max-w-full items-center gap-1.5 text-xs text-text-muted">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: LANG_COLORS[lang] ?? '#888' }}
              />
              <span className="truncate">{lang}</span>
            </span>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: Reward + Meta */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <span className="min-w-0 break-words font-mono text-lg font-semibold text-emerald sm:whitespace-nowrap">
          {formatCurrency(bounty.reward_amount, bounty.reward_token)}
        </span>
        <div data-testid="bounty-meta" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted sm:justify-end">
          <span className="inline-flex items-center gap-1">
            <GitPullRequest className="w-3.5 h-3.5" />
            {bounty.submission_count} PRs
          </span>
          {bounty.deadline && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {timeLeft(bounty.deadline)}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span data-testid="bounty-status" className={`mt-3 inline-flex items-center gap-1 self-start text-xs font-medium ${statusColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {statusLabel}
      </span>
    </motion.div>
  );
}
