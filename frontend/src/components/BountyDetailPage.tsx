'use client';

import React, { useState, useEffect } from 'react';
import BoostPanel from './BoostPanel';

interface BountyDetail {
  id: string;
  title: string;
  tier: 'T1' | 'T2' | 'T3';
  reward: number;
  category: string;
  status: 'open' | 'in_progress' | 'completed' | 'expired';
  deadline: string;
  description: string;
  requirements: string[];
  githubIssueUrl: string;
  githubIssueNumber: number;
  views: number;
  submissions: Submission[];
  activities: Activity[];
}

interface Submission {
  id: string;
  author: string;
  prUrl: string;
  prNumber: number;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  reviewScore: number;
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

const statusColors = {
  open: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  expired: 'bg-red-500/20 text-red-400',
};

export const BountyDetailPage: React.FC<{ bounty: BountyDetail }> = ({ bounty }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [showClaimModal, setShowClaimModal] = useState(false);

  // Live countdown timer
  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Mobile-first layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${tierColors[bounty.tier]}`}>
                  {bounty.tier}
                </span>
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${statusColors[bounty.status]}`}>
                  {bounty.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-gray-700 text-gray-300">
                  {bounty.category}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 break-words">
                {bounty.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm sm:text-base">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Reward:</span>
                  <span className="text-green-400 font-bold text-lg sm:text-xl">
                    {bounty.reward.toLocaleString()} FNDRY
                  </span>
                </div>
              </div>

              {/* GitHub Issue Link */}
              <a
                href={bounty.githubIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-sm text-gray-400 hover:text-white transition-colors min-h-[44px] px-3 py-2 rounded-lg hover:bg-gray-800"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span>#{bounty.githubIssueNumber} View on GitHub</span>
              </a>
            </div>

            {/* Countdown Timer */}
            <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-2">⏰ Time Remaining</h2>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-yellow-400">
                {timeRemaining}
              </p>
            </div>

            {/* Description */}
            <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">Description</h2>
              <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
                <p className="text-gray-400 whitespace-pre-wrap">{bounty.description}</p>
              </div>
            </div>

            {/* Requirements */}
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

            {/* Submissions */}
            <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">
                Submissions ({bounty.submissions.length})
              </h2>
              {bounty.submissions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No submissions yet. Be the first!</p>
              ) : (
                <div className="space-y-3">
                  {bounty.submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold">
                          {sub.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{sub.author}</p>
                          <a
                            href={sub.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:underline"
                          >
                            PR #{sub.prNumber}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[sub.status as keyof typeof statusColors]}`}>
                          {sub.status}
                        </span>
                        {sub.reviewScore > 0 && (
                          <span className="text-sm text-gray-400">
                            Score: {sub.reviewScore}/10
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Feed */}
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
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-900 rounded-lg p-4 sm:p-6 sticky top-4 space-y-4">
              <h2 className="text-lg font-semibold">Quick Stats</h2>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Views</span>
                  <span className="font-medium">{bounty.views.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Submissions</span>
                  <span className="font-medium">{bounty.submissions.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Time Left</span>
                  <span className="font-medium text-yellow-400">{timeRemaining}</span>
                </div>
              </div>

              {/* Action Buttons - Touch friendly (min 44px) */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={() => setShowClaimModal(true)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 sm:py-4 rounded-lg font-medium transition-colors min-h-[44px] touch-manipulation"
                >
                  Claim Bounty
                </button>
                <a
                  href={bounty.githubIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-purple-600 hover:bg-purple-700 text-white py-3 sm:py-4 rounded-lg font-medium transition-colors text-center min-h-[44px] touch-manipulation"
                >
                  Submit PR
                </a>
              </div>
            </div>

            {/* Boost Panel — reward pool, boost input, leaderboard, history */}
            <BoostPanel bountyId={bounty.id} bountyStatus={bounty.status} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BountyDetailPage;