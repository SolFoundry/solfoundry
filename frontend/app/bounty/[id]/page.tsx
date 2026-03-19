'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { notFound } from 'next/navigation';

// Types
interface Submission {
  id: number;
  author: string;
  authorAvatar: string;
  prNumber: number;
  status: 'pending' | 'approved' | 'changes-requested' | 'merged';
  reviewScore: number;
  submittedAt: string;
}

interface Activity {
  id: number;
  type: 'claimed' | 'pr-submitted' | 'review-posted' | 'merged' | 'paid-out';
  user: string;
  timestamp: string;
  details?: string;
}

interface BountyDetail {
  id: number;
  title: string;
  description: string;
  requirements: string[];
  tier: 'T1' | 'T2' | 'T3';
  status: 'open' | 'in-progress' | 'completed';
  reward: number;
  deadline: string;
  category: string;
  skills: string[];
  submissions: Submission[];
  activity: Activity[];
  views: number;
  repo: string;
  createdAt: string;
  claimedBy?: string;
}

// Mock data for bounty #21
const mockBountyDetail: BountyDetail = {
  id: 21,
  title: '🏭 Bounty T1: Bounty Detail Page',
  description: `# Bounty Detail Page

Build the **bounty detail page** with full information, specifications, and submission form.

## Overview
This bounty requires building a comprehensive detail page that displays all information about a bounty, including the description, requirements, submissions, and activity feed.

## UI/UX Requirements
- Dark theme with purple (#9945FF) and green (#14F195) accents
- Monospace font (SF Mono)
- Responsive layout for mobile and desktop
- Smooth animations and transitions`,
  requirements: [
    'Implement responsive layout with sidebar',
    'Add live countdown timer updating every second',
    'Render markdown description using react-markdown',
    'Display requirements as interactive checklist',
    'Show submissions list with PR status and review scores',
    'Build activity feed with real-time updates',
    'Include "Claim" and "Submit PR" CTAs',
    'Add GitHub issue link button',
  ],
  tier: 'T1',
  status: 'in-progress',
  reward: 200000,
  deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString(), // 2 days, 5 hours
  category: 'Frontend',
  skills: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS'],
  submissions: [
    {
      id: 1,
      author: 'devmaster42',
      authorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=devmaster42',
      prNumber: 156,
      status: 'pending',
      reviewScore: 0,
      submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      author: 'codewarrior',
      authorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=codewarrior',
      prNumber: 162,
      status: 'approved',
      reviewScore: 85,
      submittedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      author: 'frontendpro',
      authorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=frontendpro',
      prNumber: 171,
      status: 'changes-requested',
      reviewScore: 62,
      submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 4,
      author: 'reactninja',
      authorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=reactninja',
      prNumber: 189,
      status: 'merged',
      reviewScore: 92,
      submittedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  ],
  activity: [
    {
      id: 1,
      type: 'claimed',
      user: 'frontendpro',
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      type: 'pr-submitted',
      user: 'devmaster42',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      details: 'PR #156 submitted',
    },
    {
      id: 3,
      type: 'pr-submitted',
      user: 'codewarrior',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      details: 'PR #162 submitted',
    },
    {
      id: 4,
      type: 'review-posted',
      user: 'reviewer_alex',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      details: 'Approved PR #162 (Score: 85)',
    },
    {
      id: 5,
      type: 'pr-submitted',
      user: 'frontendpro',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      details: 'PR #171 submitted',
    },
    {
      id: 6,
      type: 'review-posted',
      user: 'reviewer_sam',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      details: 'Changes requested on PR #171 (Score: 62)',
    },
    {
      id: 7,
      type: 'pr-submitted',
      user: 'reactninja',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      details: 'PR #189 submitted',
    },
    {
      id: 8,
      type: 'merged',
      user: 'reactninja',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      details: 'PR #189 merged!',
    },
  ],
  views: 1247,
  repo: 'SolFoundry/solfoundry',
  createdAt: '2026-03-19T01:07:15Z',
  claimedBy: 'frontendpro',
};

// Countdown timer hook
function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      
      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
          total: difference,
        };
      }
      return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

// Format relative time
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = now.getTime() - time.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Tier badge component
function TierBadge({ tier }: { tier: string }) {
  const colors = {
    T1: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    T2: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    T3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  };
  
  return (
    <span className={`px-3 py-1 rounded-md text-xs font-bold border ${colors[tier as keyof typeof colors] || colors.T1}`}>
      {tier}
    </span>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors = {
    'open': 'bg-green-500/20 text-green-400 border-green-500/50',
    'in-progress': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    'completed': 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  };

  const labels = {
    'open': 'Open',
    'in-progress': 'In Progress',
    'completed': 'Completed',
  };

  return (
    <span className={`px-3 py-1 rounded-md text-xs font-semibold border ${colors[status as keyof typeof colors] || colors.open}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

// Countdown timer component
function CountdownTimer({ deadline }: { deadline: string }) {
  const { days, hours, minutes, seconds } = useCountdown(deadline);

  return (
    <div className="flex gap-2 text-center">
      <div className="bg-[#9945FF]/10 border border-[#9945FF]/30 rounded-lg px-3 py-2 min-w-[60px]">
        <div className="text-xl font-bold text-[#9945FF]">{days}</div>
        <div className="text-xs text-gray-400">DAYS</div>
      </div>
      <div className="bg-[#9945FF]/10 border border-[#9945FF]/30 rounded-lg px-3 py-2 min-w-[60px]">
        <div className="text-xl font-bold text-[#9945FF]">{hours.toString().padStart(2, '0')}</div>
        <div className="text-xs text-gray-400">HRS</div>
      </div>
      <div className="bg-[#9945FF]/10 border border-[#9945FF]/30 rounded-lg px-3 py-2 min-w-[60px]">
        <div className="text-xl font-bold text-[#9945FF]">{minutes.toString().padStart(2, '0')}</div>
        <div className="text-xs text-gray-400">MIN</div>
      </div>
      <div className="bg-[#9945FF]/10 border border-[#9945FF]/30 rounded-lg px-3 py-2 min-w-[60px]">
        <div className="text-xl font-bold text-[#9945FF]">{seconds.toString().padStart(2, '0')}</div>
        <div className="text-xs text-gray-400">SEC</div>
      </div>
    </div>
  );
}

// Submission card component
function SubmissionCard({ submission }: { submission: Submission }) {
  const statusConfig = {
    pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    approved: { label: 'Approved', color: 'text-green-400', bg: 'bg-green-400/10' },
    'changes-requested': { label: 'Changes Requested', color: 'text-red-400', bg: 'bg-red-400/10' },
    merged: { label: 'Merged', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  };

  const status = statusConfig[submission.status];

  return (
    <div className="flex items-center gap-4 p-4 bg-[#0a0a0a] border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
      <img 
        src={submission.authorAvatar} 
        alt={submission.author}
        className="w-10 h-10 rounded-full bg-gray-800"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{submission.author}</span>
          <span className="text-gray-500">•</span>
          <a 
            href={`https://github.com/${mockBountyDetail.repo}/pull/${submission.prNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#14F195] hover:underline text-sm"
          >
            PR #{submission.prNumber}
          </a>
        </div>
        <div className="text-xs text-gray-500 mt-1">{formatRelativeTime(submission.submittedAt)}</div>
      </div>
      <div className="flex items-center gap-3">
        {submission.reviewScore > 0 && (
          <div className="text-sm">
            <span className="text-gray-400">Score:</span>
            <span className={`ml-1 font-bold ${submission.reviewScore >= 80 ? 'text-green-400' : submission.reviewScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {submission.reviewScore}
            </span>
          </div>
        )}
        <span className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.color}`}>
          {status.label}
        </span>
      </div>
    </div>
  );
}

// Activity item component
function ActivityItem({ activity }: { activity: Activity }) {
  const icons = {
    'claimed': '🎯',
    'pr-submitted': '📝',
    'review-posted': '👀',
    'merged': '✅',
    'paid-out': '💰',
  };

  const labels = {
    'claimed': 'claimed this bounty',
    'pr-submitted': 'submitted a PR',
    'review-posted': 'posted a review',
    'merged': 'PR merged',
    'paid-out': 'paid out reward',
  };

  return (
    <div className="flex gap-3 py-3">
      <div className="text-lg">{icons[activity.type]}</div>
      <div className="flex-1">
        <div className="text-sm">
          <span className="text-white font-medium">{activity.user}</span>
          <span className="text-gray-400"> {labels[activity.type]}</span>
        </div>
        {activity.details && (
          <div className="text-xs text-gray-500 mt-0.5">{activity.details}</div>
        )}
      </div>
      <div className="text-xs text-gray-500">{formatRelativeTime(activity.timestamp)}</div>
    </div>
  );
}

export default function BountyDetailPage({ params }: { params: { id: string } }) {
  // In real app, fetch based on params.id
  const bounty = mockBountyDetail;

  if (!bounty || Number(params.id) !== bounty.id) {
    notFound();
  }

  const isClaimed = bounty.status === 'in-progress';

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-mono">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link 
            href="/bounties" 
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#14F195] transition-colors"
          >
            ← Back to Bounties
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bounty Header */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <TierBadge tier={bounty.tier} />
                <StatusBadge status={bounty.status} />
                <span className="px-3 py-1 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
                  {bounty.category}
                </span>
              </div>
              
              <h1 className="text-2xl font-bold text-white mb-4">{bounty.title}</h1>
              
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div>
                  <span className="text-gray-400">Reward: </span>
                  <span className="text-[#14F195] font-bold text-lg">{bounty.reward.toLocaleString()} FNDRY</span>
                </div>
                {bounty.claimedBy && (
                  <div>
                    <span className="text-gray-400">Claimed by: </span>
                    <span className="text-white">{bounty.claimedBy}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">⏰ Time Remaining</h2>
              <CountdownTimer deadline={bounty.deadline} />
            </div>

            {/* Description */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">📋 Description</h2>
              <div className="prose prose-invert prose-purple max-w-none">
                <ReactMarkdown>{bounty.description}</ReactMarkdown>
              </div>
            </div>

            {/* Requirements Checklist */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">✅ Requirements</h2>
              <ul className="space-y-3">
                {bounty.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded border border-[#9945FF] flex-shrink-0 mt-0.5 flex items-center justify-center">
                      <svg className="w-3 h-3 text-[#9945FF]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-300">{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Submissions */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">📨 Submissions</h2>
                <span className="text-sm text-gray-400">{bounty.submissions.length} total</span>
              </div>
              <div className="space-y-3">
                {bounty.submissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">📊 Activity Feed</h2>
              <div className="divide-y divide-gray-800">
                {bounty.activity.map((item) => (
                  <ActivityItem key={item.id} activity={item} />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6 mt-8 lg:mt-0">
            {/* Quick Stats */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Views</span>
                  <span className="text-white font-medium">{bounty.views.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Submissions</span>
                  <span className="text-white font-medium">{bounty.submissions.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Time Left</span>
                  <CountdownTimer deadline={bounty.deadline} />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <div className="space-y-3">
                {isClaimed ? (
                  <a
                    href={`https://github.com/${bounty.repo}/pulls`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-4 rounded-lg bg-[#9945FF] text-white font-semibold text-center hover:bg-[#9945FF]/80 transition-colors"
                  >
                    Submit PR
                  </a>
                ) : (
                  <button
                    className="w-full py-3 px-4 rounded-lg bg-[#14F195] text-black font-semibold text-center hover:bg-[#14F195]/80 transition-colors"
                  >
                    Claim Bounty
                  </button>
                )}
                
                <a
                  href={`https://github.com/${bounty.repo}/issues/${bounty.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 px-4 rounded-lg border border-gray-700 text-gray-300 font-semibold text-center hover:border-gray-500 hover:text-white transition-colors"
                >
                  View GitHub Issue
                </a>
              </div>
            </div>

            {/* Skills */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {bounty.skills.map((skill) => (
                  <span 
                    key={skill}
                    className="px-3 py-1 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
