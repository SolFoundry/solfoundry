import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { GitPullRequest, Clock, ArrowRight } from 'lucide-react';
import type { Bounty } from '../../types/bounty';
import { cardTap, mobileStaggerItem } from '../../lib/animations';
import { timeLeft, formatCurrency, LANG_COLORS } from '../../lib/utils';

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    T1: 'bg-tier-t1/10 text-tier-t1 border border-tier-t1/20',
    T2: 'bg-tier-t2/10 text-tier-t2 border border-tier-t2/20',
    T3: 'bg-tier-t3/10 text-tier-t3 border border-tier-t3/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${styles[tier] ?? styles.T1}`}>
      {tier}
    </span>
  );
}

interface BountyCardProps {
  bounty: Bounty;
  index?: number;
}

export function BountyCard({ bounty, index = 0 }: BountyCardProps) {
  const navigate = useNavigate();
  const [isPressed, setIsPressed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Swipe gesture handling for mobile quick actions
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0, 100], [0.5, 1, 0.5]);
  const background = useTransform(
    x,
    [-100, 0, 100],
    ['rgba(0,230,118,0.1)', 'rgba(0,0,0,0)', 'rgba(224,64,251,0.1)']
  );

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

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Swipe threshold for quick actions
    if (Math.abs(info.offset.x) > 80) {
      // Could trigger quick actions here (save, share, etc.)
      setShowPreview(true);
      setTimeout(() => setShowPreview(false), 2000);
    }
  };

  const handleClick = () => {
    navigate(`/bounties/${bounty.id}`);
  };

  return (
    <motion.article
      variants={mobileStaggerItem}
      initial="initial"
      animate="animate"
      whileTap="tap"
      style={{ x, opacity, background }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      className={`relative rounded-xl border border-border bg-forge-900 p-3 sm:p-4 lg:p-5 cursor-pointer transition-all duration-200 overflow-hidden group min-h-[180px] sm:min-h-[200px] flex flex-col tap-highlight ${isPressed ? 'scale-[0.98]' : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Bounty: ${bounty.title}, Reward: ${formatCurrency(bounty.reward_amount, bounty.reward_token)}, Status: ${statusLabel}`}
    >
      {/* Quick Preview Indicator (shown on swipe) */}
      {showPreview && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute top-2 right-2 z-10 px-2 py-1 bg-emerald/20 border border-emerald/30 rounded text-[10px] text-emerald font-medium"
        >
          Swipe for quick actions
        </motion.div>
      )}

      {/* Row 1: Repo + Tier */}
      <div className="flex items-start sm:items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          {bounty.org_avatar_url && (
            <img 
              src={bounty.org_avatar_url} 
              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0" 
              alt="" 
              loading="lazy"
            />
          )}
          <span className="text-text-muted font-mono text-[10px] sm:text-xs truncate">
            {orgName}/{repoName}
            {issueNumber && <span className="ml-0.5 sm:ml-1">#{issueNumber}</span>}
          </span>
        </div>
        <TierBadge tier={bounty.tier ?? 'T1'} />
      </div>

      {/* Row 2: Title */}
      <h3 className="mt-2 sm:mt-3 font-sans text-sm sm:text-base font-semibold text-text-primary leading-snug line-clamp-2 flex-grow">
        {bounty.title}
      </h3>

      {/* Row 3: Language dots */}
      {skills.length > 0 && (
        <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3 flex-wrap">
          {skills.map((lang) => (
            <span key={lang} className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-text-muted">
              <span
                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: LANG_COLORS[lang] ?? '#888' }}
              />
              <span className="hidden xs:inline">{lang}</span>
            </span>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="mt-3 sm:mt-4 border-t border-border/50" />

      {/* Row 4: Reward + Meta + Status */}
      <div className="flex items-center justify-between mt-2 sm:mt-3 gap-2">
        <span className="font-mono text-base sm:text-lg font-semibold text-emerald truncate">
          {formatCurrency(bounty.reward_amount, bounty.reward_token)}
        </span>
        
        {/* Status badge - inline on mobile instead of absolute */}
        <span className={`text-[10px] sm:text-xs font-medium inline-flex items-center gap-1 flex-shrink-0 ${statusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="hidden xs:inline">{statusLabel}</span>
          <span className="xs:hidden">{statusLabel.split(' ')[0]}</span>
        </span>
      </div>
      
      {/* Row 5: Meta info (PRs, Deadline) */}
      <div className="flex items-center gap-2 sm:gap-3 mt-2 text-[10px] sm:text-xs text-text-muted">
        <span className="inline-flex items-center gap-1">
          <GitPullRequest className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
          <span className="truncate">{bounty.submission_count} PRs</span>
        </span>
        {bounty.deadline && (
          <span className="inline-flex items-center gap-1 truncate">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span className="truncate">{timeLeft(bounty.deadline)}</span>
          </span>
        )}
      </div>

      {/* Mobile Quick Action Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isPressed ? 1 : 0 }}
        className="absolute inset-0 bg-gradient-to-r from-emerald/5 via-transparent to-magenta/5 pointer-events-none"
      />
    </motion.article>
  );
}
