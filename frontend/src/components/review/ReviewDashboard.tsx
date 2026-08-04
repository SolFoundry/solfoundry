import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Brain, FileText, TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';
import { PageLayout } from '../layout/PageLayout';
import { ReviewScoreCard } from './ReviewScoreCard';
import { ConsensusIndicator } from './ConsensusIndicator';
import { AppealHistory } from './AppealWorkflow';
import { useSubmissionReviews, useReviewDashboardStats, useAppeals } from '../../hooks/useReviews';
import type { LLMReviewScore } from '../../types/review';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color: string;
}

function StatCard({ icon, label, value, sublabel, color }: StatCardProps) {
  return (
    <motion.div variants={fadeIn} className="rounded-xl border border-border bg-forge-900 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-xs text-text-muted font-medium">{label}</span>
      </div>
      <p className="font-mono text-2xl font-bold text-text-primary">{value}</p>
      {sublabel && <p className="text-xs text-text-muted mt-1">{sublabel}</p>}
    </motion.div>
  );
}

export function ReviewDashboard() {
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState('');

  const { data: stats, isLoading: statsLoading } = useReviewDashboardStats();
  const { data: reviewsData, isLoading: reviewsLoading } = useSubmissionReviews(submissionId || undefined);
  const { data: appealsData, isLoading: appealsLoading } = useAppeals({ limit: 10 });

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div variants={fadeIn} initial="initial" animate="animate" className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple to-magenta flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-text-primary">Review Dashboard</h1>
              <p className="text-text-secondary text-sm">Multi-LLM review scores, consensus, and appeals</p>
            </div>
          </div>
        </motion.div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            icon={<BarChart2 className="w-4 h-4 text-purple-light" />}
            label="Total Reviews"
            value={stats?.total_reviews ?? '—'}
            color="bg-purple-bg"
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4 text-emerald" />}
            label="Pass Rate"
            value={stats ? `${(stats.pass_rate * 100).toFixed(0)}%` : '—'}
            color="bg-emerald-bg"
          />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4 text-status-warning" />}
            label="Dispute Rate"
            value={stats ? `${(stats.dispute_rate * 100).toFixed(0)}%` : '—'}
            color="bg-status-warning/10"
          />
          <StatCard
            icon={<Brain className="w-4 h-4 text-magenta" />}
            label="Today"
            value={stats?.reviews_today ?? '—'}
            sublabel="reviews today"
            color="bg-magenta-bg"
          />
          <StatCard
            icon={<Users className="w-4 h-4 text-status-info" />}
            label="Open Appeals"
            value={stats?.open_appeals ?? '—'}
            color="bg-status-info/10"
          />
          <StatCard
            icon={<Clock className="w-4 h-4 text-text-muted" />}
            label="Avg Review Time"
            value={stats ? `${stats.avg_review_time_hours.toFixed(1)}h` : '—'}
            color="bg-forge-800"
          />
        </div>

        {/* Provider stats */}
        {stats?.provider_stats && (
          <motion.div variants={fadeIn} initial="initial" animate="animate" className="rounded-xl border border-border bg-forge-900 p-6 mb-8">
            <h3 className="font-sans text-lg font-semibold text-text-primary mb-4">Provider Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.provider_stats.map((p) => {
                const colorMap: Record<string, string> = {
                  claude: 'text-purple-light',
                  codex: 'text-emerald',
                  gemini: 'text-status-info',
                };
                const bgMap: Record<string, string> = {
                  claude: 'bg-purple-bg',
                  codex: 'bg-emerald-bg',
                  gemini: 'bg-status-info/10',
                };
                const barMap: Record<string, string> = {
                  claude: 'bg-purple',
                  codex: 'bg-emerald',
                  gemini: 'bg-status-info',
                };
                return (
                  <div key={p.provider} className={`p-4 rounded-lg ${bgMap[p.provider] ?? 'bg-forge-800'} border border-border`}>
                    <p className={`text-sm font-semibold ${colorMap[p.provider] ?? 'text-text-primary'} mb-2 capitalize`}>
                      {p.provider}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted">Reviews</span>
                        <span className="font-mono text-text-primary">{p.total_reviews}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted">Avg Score</span>
                        <span className={`font-mono font-semibold ${colorMap[p.provider] ?? ''}`}>
                          {p.avg_score.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted">Avg Time</span>
                        <span className="font-mono text-text-muted">{(p.avg_review_time_seconds / 60).toFixed(0)}m</span>
                      </div>
                      {/* Score bar */}
                      <div className="h-1.5 rounded-full bg-forge-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barMap[p.provider] ?? 'bg-purple'}/60`}
                          style={{ width: `${(p.avg_score / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Submission review lookup */}
        <motion.div variants={fadeIn} initial="initial" animate="animate" className="rounded-xl border border-border bg-forge-900 p-6 mb-8">
          <h3 className="font-sans text-lg font-semibold text-text-primary mb-4">Submission Review</h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={submissionId}
              onChange={(e) => setSubmissionId(e.target.value)}
              placeholder="Enter submission ID to view reviews..."
              className="flex-1 px-3 py-2 rounded-lg bg-forge-800 border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-active"
            />
            <div className="w-5 h-5 text-text-muted">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </motion.div>

        {/* Review scores */}
        {reviewsLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-purple border-t-transparent animate-spin" />
          </div>
        )}

        {reviewsData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Consensus panel */}
            <div className="lg:col-span-1">
              <ConsensusIndicator consensus={reviewsData.consensus} />
            </div>

            {/* LLM scores */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-sans text-lg font-semibold text-text-primary">LLM Scores</h3>
              {reviewsData.reviews.map((review: LLMReviewScore, i: number) => (
                <ReviewScoreCard
                  key={review.id}
                  review={review}
                  index={i}
                  expanded={expandedReview === review.id}
                  onExpand={(id) => setExpandedReview(expandedReview === id ? null : id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Appeals section */}
        <div className="mt-8">
          {appealsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-purple border-t-transparent animate-spin" />
            </div>
          ) : (
            <AppealHistory appeals={appealsData?.items ?? []} isReviewer />
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default ReviewDashboard;