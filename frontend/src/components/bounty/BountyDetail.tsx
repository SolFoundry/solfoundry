import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, GitPullRequest, ExternalLink, Loader2, Check, Copy } from 'lucide-react';
import type { Bounty } from '../../types/bounty';
import { CountdownTimer } from './CountdownTimer';
import { timeAgo, formatCurrency, LANG_COLORS } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { SubmissionForm } from './SubmissionForm';
import { fadeIn } from '../../lib/animations';

interface BountyDetailProps {
  bounty: Bounty;
}

export function BountyDetail({ bounty }: BountyDetailProps) {
  const { isAuthenticated } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Bounties
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title + meta */}
          <div className="rounded-xl border border-border bg-forge-900 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3 text-xs font-mono text-text-muted">
                  {bounty.org_avatar_url && (
                    <img src={bounty.org_avatar_url} alt="" className="w-4 h-4 rounded-full" />
                  )}
                  <span>{bounty.org_name}/{bounty.repo_name}</span>
                  {bounty.issue_number && <span>#{bounty.issue_number}</span>}
                </div>
                <h1 className="font-sans text-2xl font-semibold text-text-primary">{bounty.title}</h1>
              </div>
              <button
                onClick={copyLink}
                className="flex-shrink-0 p-2 rounded-lg bg-forge-800 border border-border hover:border-border-hover text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                {copied ? <Check className="w-4 h-4 text-emerald" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Skills */}
            {bounty.skills?.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                {bounty.skills.map((lang) => (
                  <span key={lang} className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LANG_COLORS[lang] ?? '#888' }} />
                    {lang}
                  </span>
                ))}
              </div>
            )}

            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {bounty.description}
            </p>

            {bounty.github_issue_url && (
              <a
                href={bounty.github_issue_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-emerald hover:text-emerald-light transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View on GitHub
              </a>
            )}
          </div>

          {/* Submission Form */}
          {isAuthenticated && !submitting && (
            <div className="rounded-xl border border-border bg-forge-900 p-6">
              <SubmissionForm bounty={bounty} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Reward */}
          <div className="rounded-xl border border-border bg-forge-900 p-5">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Reward</h3>
            <p className="font-mono text-2xl font-bold text-emerald">
              {formatCurrency(bounty.reward_amount, bounty.reward_token)}
            </p>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Details</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Status</span>
              <span className="font-mono text-emerald capitalize">{bounty.status}</span>
            </div>
            {bounty.deadline && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Deadline</span>
                <CountdownTimer deadline={bounty.deadline} />
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Submissions</span>
              <span className="font-mono text-text-primary inline-flex items-center gap-1">
                <GitPullRequest className="w-3.5 h-3.5" /> {bounty.submission_count}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Created</span>
              <span className="font-mono text-text-primary">{timeAgo(bounty.created_at)}</span>
            </div>
          </div>

          {/* GitHub Link */}
          {bounty.github_repo_url && (
            <a
              href={bounty.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-border bg-forge-900 p-5 hover:bg-forge-800 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="w-4 h-4 text-text-muted" />
                <span className="text-text-primary">View Repository</span>
              </div>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}