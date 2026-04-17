import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, GitPullRequest, ExternalLink, Loader2, Check, Copy } from 'lucide-react';
import type { Bounty, LLMReviewSummary } from '../../types/bounty';
import { timeLeft, timeAgo, formatCurrency, LANG_COLORS } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { SubmissionForm } from './SubmissionForm';
import { LLMReviewPanel } from './LLMReviewPanel';
import { fadeIn } from '../../lib/animations';

// Mock LLM review data — in production this comes from the backend
function getMockLLMReview(bountyId: string): LLMReviewSummary {
  const hash = bountyId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = (hash % 30 + 60) / 10; // 6.0 – 8.9
  return {
    reviews: [
      {
        model: 'claude',
        score: Math.min(10, +(base + 0.3).toFixed(1)),
        confidence: 87,
        summary: 'Well-structured implementation with clear separation of concerns. The component architecture follows React best practices with proper state management.',
        strengths: ['Clean component hierarchy', 'Proper TypeScript typing', 'Accessible markup'],
        improvements: ['Add error boundary handling', 'Consider memoization for heavy computations'],
        reasoning: 'The submission demonstrates solid understanding of the requirements. Code quality is high with consistent formatting. Minor issues with edge case handling but overall a strong submission.',
        reviewed_at: new Date().toISOString(),
      },
      {
        model: 'codex',
        score: Math.min(10, +(base - 0.1).toFixed(1)),
        confidence: 82,
        summary: 'Functional implementation meeting core requirements. Good use of the existing design system components.',
        strengths: ['Consistent with codebase patterns', 'Good test coverage structure'],
        improvements: ['Enhance loading states', 'Add skeleton placeholders'],
        reviewed_at: new Date().toISOString(),
      },
      {
        model: 'gemini',
        score: Math.min(10, +(base + 0.1).toFixed(1)),
        confidence: 79,
        summary: 'Solid implementation with attention to UX details. Responsive design works well across breakpoints.',
        strengths: ['Responsive layout', 'Smooth animations', 'Clear visual hierarchy'],
        improvements: ['Optimize bundle size', 'Add ARIA labels for interactive elements'],
        reviewed_at: new Date().toISOString(),
      },
    ],
    average_score: +((base + 0.3 + base - 0.1 + base + 0.1) / 3).toFixed(1),
    consensus: base >= 7.5 ? 'strong_approve' : base >= 6.5 ? 'approve' : base >= 5 ? 'mixed' : 'reject',
    quality_indicators: {
      code_quality: Math.min(10, +(base + 0.2).toFixed(1)),
      completeness: Math.min(10, +(base - 0.3).toFixed(1)),
      adherence: Math.min(10, +(base + 0.1).toFixed(1)),
    },
  };
}

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
                <ExternalLink className="w-3.5 h-3.5" /> View GitHub Issue
              </a>
            )}
          </div>

          {/* Description / requirements */}
          <div className="rounded-xl border border-border bg-forge-900 p-6">
            <h2 className="font-sans text-lg font-semibold text-text-primary mb-4">Requirements</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Submit a working solution that addresses the bounty requirements above.
              All submissions are reviewed by our AI pipeline (3 LLMs, pass threshold 7.0/10).
            </p>
          </div>

          {/* LLM Review Results */}
          <LLMReviewPanel summary={getMockLLMReview(bounty.id)} />

          {/* Submission form */}
          {bounty.status === 'open' || bounty.status === 'funded' ? (
            <div className="rounded-xl border border-border bg-forge-900 p-6">
              <h2 className="font-sans text-lg font-semibold text-text-primary mb-4">Submit Your Solution</h2>
              {isAuthenticated ? (
                <SubmissionForm bounty={bounty} />
              ) : (
                <div className="text-center py-6">
                  <p className="text-text-muted text-sm mb-4">Sign in with GitHub to submit a solution.</p>
                  <a
                    href="/api/auth/github/authorize"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forge-800 border border-border hover:border-border-hover text-text-primary text-sm font-medium transition-all duration-200"
                  >
                    Sign in with GitHub
                  </a>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Reward card */}
          <div className="rounded-xl border border-emerald-border bg-emerald-bg/50 p-5">
            <p className="text-xs text-text-muted font-mono mb-1">Reward</p>
            <p className="font-mono text-3xl font-bold text-emerald">
              {formatCurrency(bounty.reward_amount, bounty.reward_token)}
            </p>
          </div>

          {/* Info card */}
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Status</span>
              <span className={`font-medium ${bounty.status === 'open' ? 'text-emerald' : 'text-magenta'}`}>
                {bounty.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Tier</span>
              <span className="font-mono text-text-primary">{bounty.tier ?? 'T1'}</span>
            </div>
            {bounty.deadline && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Deadline</span>
                <span className="font-mono text-status-warning inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {timeLeft(bounty.deadline)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Submissions</span>
              <span className="font-mono text-text-primary inline-flex items-center gap-1">
                <GitPullRequest className="w-3.5 h-3.5" /> {bounty.submission_count}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Posted</span>
              <span className="font-mono text-text-muted">{timeAgo(bounty.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
