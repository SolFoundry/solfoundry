'use client';

import React, { useState, useEffect } from 'react';
import { EscrowStatus } from './wallet/EscrowStatus';
import { useBountySubmission } from '../hooks/useBountySubmission';
import ReviewScoresPanel from './bounties/ReviewScoresPanel';
import SubmissionForm from './bounties/SubmissionForm';
import CreatorApprovalPanel from './bounties/CreatorApprovalPanel';
import LifecycleTimeline from './bounties/LifecycleTimeline';

interface BountyDetail {
  id: string;
  title: string;
  tier: 'T1' | 'T2' | 'T3';
  reward: number;
  reward_amount?: number;
  category: string;
  status: string;
  deadline: string;
  description: string;
  requirements: string[];
  githubIssueUrl: string;
  github_issue_url?: string;
  githubIssueNumber: number;
  views: number;
  submissions: any[];
  activities: Activity[];
  escrowFunded?: boolean;
  escrowAmount?: number;
  escrowSignature?: string;
  created_by?: string;
  winner_submission_id?: string;
  winner_wallet?: string;
  payout_tx_hash?: string;
  payout_at?: string;
}

interface Activity {
  id: string;
  type: 'claimed' | 'pr_submitted' | 'review_posted' | 'merged' | 'paid_out';
  actor: string;
  timestamp: string;
}

const tierColors = {
  T1: 'bg-green-500/20 text-green-400 border-green-500/30',
  T2: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  T3: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  under_review: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-green-500/20 text-green-400',
  disputed: 'bg-red-500/20 text-red-400',
  paid: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  expired: 'bg-red-500/20 text-red-400',
};

export const BountyDetailPage: React.FC<{ bounty: BountyDetail }> = ({ bounty }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [selectedReviewSub, setSelectedReviewSub] = useState<string | null>(null);

  const rewardAmount = bounty.reward_amount ?? bounty.reward;
  const githubUrl = bounty.github_issue_url ?? bounty.githubIssueUrl;

  const {
    submissions,
    reviewScores,
    lifecycle,
    loading,
    error,
    fetchSubmissions,
    submitSolution,
    fetchReviewScores,
    approveSubmission,
    disputeSubmission,
    fetchLifecycle,
  } = useBountySubmission(bounty.id);

  useEffect(() => {
    fetchSubmissions();
    fetchLifecycle();
  }, [fetchSubmissions, fetchLifecycle]);

  useEffect(() => {
    if (submissions.length > 0 && !selectedReviewSub) {
      const sub = submissions.find(s => Object.keys(s.ai_scores_by_model || {}).length > 0) || submissions[0];
      if (sub) {
        setSelectedReviewSub(sub.id);
        fetchReviewScores(sub.id);
      }
    }
  }, [submissions, selectedReviewSub, fetchReviewScores]);

  useEffect(() => {
    if (!bounty.deadline) return;
    const updateTimer = () => {
      const now = new Date().getTime();
      const deadline = new Date(bounty.deadline).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [bounty.deadline]);

  const currentUserWallet = localStorage.getItem('wallet_address') || '';
  const isCreator = bounty.created_by === currentUserWallet || false;
  const canSubmit = ['open', 'in_progress'].includes(bounty.status);
  const isPaidOrComplete = ['paid', 'completed'].includes(bounty.status);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${tierColors[bounty.tier] || tierColors.T2}`}>
                  {bounty.tier}
                </span>
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${statusColors[bounty.status] || statusColors.open}`}>
                  {bounty.status.replace('_', ' ').toUpperCase()}
                </span>
                {bounty.category && (
                  <span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-gray-700 text-gray-300">
                    {bounty.category}
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 break-words">
                {bounty.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm sm:text-base">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Reward:</span>
                  <span className="text-green-400 font-bold text-lg sm:text-xl">
                    {rewardAmount.toLocaleString()} FNDRY
                  </span>
                </div>
              </div>

              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 text-sm text-gray-400 hover:text-white transition-colors min-h-[44px] px-3 py-2 rounded-lg hover:bg-gray-800"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  <span>#{bounty.githubIssueNumber} View on GitHub</span>
                </a>
              )}

              {/* Winner badge */}
              {bounty.winner_wallet && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <span className="text-lg">🏆</span>
                    Winner: <code className="font-mono">{bounty.winner_wallet.slice(0, 12)}...</code>
                  </div>
                  {bounty.payout_tx_hash && (
                    <a
                      href={`https://solscan.io/tx/${bounty.payout_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
                    >
                      View payout tx on Solscan
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Countdown Timer */}
            {bounty.deadline && (
              <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-300 mb-2">Time Remaining</h2>
                <p className="text-2xl sm:text-3xl font-mono font-bold text-yellow-400">
                  {timeRemaining}
                </p>
              </div>
            )}

            {/* Description */}
            <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Description</h2>
              <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
                <p className="text-gray-400 whitespace-pre-wrap">{bounty.description}</p>
              </div>
            </div>

            {/* Requirements */}
            {bounty.requirements && bounty.requirements.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-300 mb-4">Requirements</h2>
                <ul className="space-y-2">
                  {bounty.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-3 min-h-[44px]">
                      <span className="text-green-400 mt-1">✓</span>
                      <span className="text-gray-400">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Review Scores */}
            {selectedReviewSub && (
              <ReviewScoresPanel
                scores={reviewScores[selectedReviewSub] || null}
                loading={loading}
              />
            )}

            {/* Submission Form */}
            {canSubmit && (
              showSubmitForm ? (
                <SubmissionForm
                  bountyId={bounty.id}
                  onSubmit={submitSolution}
                  loading={loading}
                  error={error}
                />
              ) : (
                <div className="bg-gray-900 rounded-lg p-4 sm:p-6 text-center">
                  <button
                    onClick={() => setShowSubmitForm(true)}
                    className="px-6 py-3 bg-[#9945FF] hover:bg-[#7C3AED] text-white rounded-lg font-medium transition-colors min-h-[44px]"
                  >
                    Submit a Solution
                  </button>
                </div>
              )
            )}

            {/* Creator Approval Panel / Submissions List */}
            <CreatorApprovalPanel
              submissions={submissions}
              reviewScores={reviewScores}
              onApprove={approveSubmission}
              onDispute={disputeSubmission}
              onFetchReview={fetchReviewScores}
              loading={loading}
              isCreator={isCreator}
            />

            {/* Lifecycle Timeline */}
            <LifecycleTimeline entries={lifecycle} />

            {/* Legacy Activity Feed */}
            {bounty.activities && bounty.activities.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-300 mb-4">Activity</h2>
                <div className="space-y-3">
                  {bounty.activities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-gray-400">
                        <span className="font-medium text-white">{activity.actor}</span>
                        {' '}
                        {activity.type.replace('_', ' ')}
                      </span>
                      <span className="text-gray-500 ml-auto">{activity.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-gray-900 rounded-lg p-4 sm:p-6 sticky top-4 space-y-4">
              <h2 className="text-lg font-semibold">Quick Stats</h2>

              <div className="space-y-3">
                {bounty.views !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Views</span>
                    <span className="font-medium">{bounty.views.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Submissions</span>
                  <span className="font-medium">{submissions.length || bounty.submissions?.length || 0}</span>
                </div>
                {bounty.deadline && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Time Left</span>
                    <span className="font-medium text-yellow-400">{timeRemaining}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[bounty.status] || ''}`}>
                    {bounty.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                {canSubmit && !showSubmitForm && (
                  <button
                    onClick={() => setShowSubmitForm(true)}
                    className="w-full bg-[#9945FF] hover:bg-[#7C3AED] text-white py-3 sm:py-4 rounded-lg font-medium transition-colors min-h-[44px] touch-manipulation"
                  >
                    Submit PR
                  </button>
                )}
                {githubUrl && (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-gray-800 hover:bg-gray-700 text-white py-3 sm:py-4 rounded-lg font-medium transition-colors text-center min-h-[44px] touch-manipulation"
                  >
                    View on GitHub
                  </a>
                )}
              </div>
            </div>

            {/* Escrow Status */}
            <EscrowStatus
              funded={bounty.escrowFunded ?? isPaidOrComplete}
              amount={bounty.escrowAmount ?? rewardAmount}
              signature={bounty.escrowSignature ?? bounty.payout_tx_hash}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BountyDetailPage;