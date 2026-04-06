import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitPullRequest } from 'lucide-react';
import type { Bounty } from '../../types/bounty';
import { cardHover } from '../../lib/animations';
import { formatCurrency, LANG_COLORS } from '../../lib/utils';
import { BountyCountdown } from './BountyCountdown';

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

  return (
    <motion.div
      variants={cardHover}
      initial="rest"
      whileHover="hover"
      onClick={() => navigate(`/bounties/${bounty.id}`)}
      className="relative rounded-xl border border-border bg-forge-900 p-4 sm:p-5 cursor-pointer transition-colors duration-200 overflow-hidden group min-w-0"
    >
      <div className="flex items-start justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {bounty.org_avatar_url && (
            <img src={bounty.org_avatar_url} className="w-5 h-5 rounded-full flex-shrink-0" alt="" />
          )}
          <span className="text-text-muted font-mono text-[11px] sm:text-xs truncate block min-w-0">
            {orgName}/{repoName}
            {issueNumber && <span className="ml-1">#{issueNumber}</span>}
          </span>
        </div>
        <div className="flex-shrink-0">
          <TierBadge tier={bounty.tier ?? 'T1'} />
        </div>
      </div>

      <h3 className="mt-3 font-sans text-sm sm:text-base font-semibold text-text-primary leading-snug line-clamp-3 sm:line-clamp-2 break-words">
        {bounty.title}
      </h3>

      {skills.length > 0 && (
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap mt-3 min-w-0">
          {skills.map((lang) => (
            <span key={lang} className="inline-flex items-center gap-1.5 text-xs text-text-muted max-w-full">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: LANG_COLORS[lang] ?? '#888' }} />
              <span className="truncate">{lang}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-border/50" />

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-base sm:text-lg font-semibold text-emerald truncate">
          {formatCurrency(bounty.reward_amount, bounty.reward_token)}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-text-muted sm:justify-end">
          <span className="inline-flex items-center gap-1">
            <GitPullRequest className="w-3.5 h-3.5" />
            {bounty.submission_count} PRs
          </span>
          {bounty.deadline && <BountyCountdown deadline={bounty.deadline} compact />}
        </div>
      </div>

      <div className={`mt-3 sm:mt-4 text-xs font-medium inline-flex items-center gap-1 ${statusColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {statusLabel}
      </div>
    </motion.div>
  );
}
