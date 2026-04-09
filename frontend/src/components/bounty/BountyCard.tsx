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

  return (
    <motion.div
      variants={cardHover}
      initial="rest"
      whileHover="hover"
      onClick={() => navigate(`/bounties/${bounty.id}`)}
      className="relative rounded-xl border border-border bg-forge-900 p-5 cursor-pointer transition-colors duration-200 overflow-hidden group"
    >
      {/* Row 1: Repo + Tier */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 min-w-0">
          {bounty.org_avatar_url && (
            <img src={bounty.org_avatar_url} className="w-5 h-5 rounded-full flex-shrink-0" alt="" />
          )}
          <span className="text-text-muted font-mono text-xs truncate">
            {orgName}/{repoName}
            {issueNumber && <span className="ml-1">#{issueNumber}</span>}
          </span>
        </div>
        <TierBadge tier={bounty.tier ?? 'T1'} />
      </div>

      {/* Row 2: Title */}
      <h3 className="mt-3 font-sans text-base font-semibold text-text-primary leading-snug line-clamp-2">
        {bounty.title}
      </h3>

      {/* Row 3: Language dots */}
      {skills.length > 0 && (
        <div className="flex items-center gap-3 mt-3">
          {skills.map((lang) => (
            <span key={lang} className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: LANG_COLORS[lang] ?? '#888' }}
              />
              {lang}
            </span>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: Reward + Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3">
        <span className="font-mono text-lg font-semibold text-emerald">
          {formatCurrency(bounty.reward_amount, bounty.reward_token)}
        </span>
        <div className="flex items-center gap-3 text-xs text-text-muted">
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
      <div className="mt-2 flex justify-end">
        <span className={`text-xs font-medium inline-flex items-center gap-1 ${statusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          {statusLabel}
        </span>
      </div>
    </motion.div>
  );
}
