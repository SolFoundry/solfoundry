import type { BountyTimelineData } from '../types/timeline';

/**
 * Mock Timeline Data - 3 bounties at different lifecycle stages
 */

// Bounty 1: Early stage - just created, no submissions yet
export const timelineEarlyStage: BountyTimelineData = {
  bountyId: 'b-early-1',
  bountyTitle: 'Implement Wallet Connection Flow',
  currentStage: 'open_for_submissions',
  stages: [
    {
      stage: 'created',
      status: 'completed',
      date: '2024-01-15T10:30:00Z',
      details: {
        creator: 'SolFoundry',
      },
    },
    {
      stage: 'open_for_submissions',
      status: 'current',
      date: '2024-01-15T10:30:00Z',
      details: {},
    },
    {
      stage: 'pr_submitted',
      status: 'pending',
      date: '',
      details: {},
    },
    {
      stage: 'ai_review',
      status: 'pending',
      date: '',
      details: {},
    },
    {
      stage: 'approved_merged',
      status: 'pending',
      date: '',
      details: {},
    },
    {
      stage: 'paid',
      status: 'pending',
      date: '',
      details: {},
    },
  ],
};

// Bounty 2: Mid stage - multiple PRs submitted, under review
export const timelineMidStage: BountyTimelineData = {
  bountyId: 'b-mid-1',
  bountyTitle: 'Build Staking Dashboard Component',
  currentStage: 'ai_review',
  stages: [
    {
      stage: 'created',
      status: 'completed',
      date: '2024-01-10T14:00:00Z',
      details: {
        creator: 'SolFoundry',
      },
    },
    {
      stage: 'open_for_submissions',
      status: 'completed',
      date: '2024-01-10T14:00:00Z',
      details: {},
    },
    {
      stage: 'pr_submitted',
      status: 'completed',
      date: '2024-01-12T09:15:00Z',
      details: {
        author: 'dev_alice',
        prNumber: 142,
        prUrl: 'https://github.com/SolFoundry/solfoundry/pull/142',
      },
    },
    {
      stage: 'ai_review',
      status: 'current',
      date: '2024-01-13T11:00:00Z',
      details: {
        score: 8,
        verdict: 'Strong implementation with minor improvements needed',
        submissionId: 'sub-001',
      },
    },
    {
      stage: 'approved_merged',
      status: 'pending',
      date: '',
      details: {},
    },
    {
      stage: 'paid',
      status: 'pending',
      date: '',
      details: {},
    },
  ],
};

// Bounty 3: Completed stage - fully paid out
export const timelineCompleted: BountyTimelineData = {
  bountyId: 'b-complete-1',
  bountyTitle: 'API Documentation Generation',
  currentStage: 'paid',
  stages: [
    {
      stage: 'created',
      status: 'completed',
      date: '2024-01-05T08:00:00Z',
      details: {
        creator: 'SolFoundry',
      },
    },
    {
      stage: 'open_for_submissions',
      status: 'completed',
      date: '2024-01-05T08:00:00Z',
      details: {},
    },
    {
      stage: 'pr_submitted',
      status: 'completed',
      date: '2024-01-06T16:30:00Z',
      details: {
        author: 'dev_bob',
        prNumber: 138,
        prUrl: 'https://github.com/SolFoundry/solfoundry/pull/138',
      },
    },
    {
      stage: 'ai_review',
      status: 'completed',
      date: '2024-01-07T10:00:00Z',
      details: {
        score: 9,
        verdict: 'Excellent documentation with comprehensive coverage',
        submissionId: 'sub-002',
      },
    },
    {
      stage: 'approved_merged',
      status: 'completed',
      date: '2024-01-07T14:20:00Z',
      details: {
        mergedPrNumber: 138,
        mergedPrUrl: 'https://github.com/SolFoundry/solfoundry/pull/138',
      },
    },
    {
      stage: 'paid',
      status: 'completed',
      date: '2024-01-08T09:00:00Z',
      details: {
        amount: 200000,
        recipient: 'dev_bob',
        txHash: '5Kq7...mNpQ',
        txUrl: 'https://solscan.io/tx/5Kq7mNpQ...',
      },
    },
  ],
};

// Bounty 4: Edge case - rejected bounty
export const timelineRejected: BountyTimelineData = {
  bountyId: 'b-rejected-1',
  bountyTitle: 'Fix Critical Security Vulnerability',
  currentStage: 'ai_review',
  stages: [
    {
      stage: 'created',
      status: 'completed',
      date: '2024-01-08T12:00:00Z',
      details: {
        creator: 'SolFoundry',
      },
    },
    {
      stage: 'open_for_submissions',
      status: 'completed',
      date: '2024-01-08T12:00:00Z',
      details: {},
    },
    {
      stage: 'pr_submitted',
      status: 'completed',
      date: '2024-01-09T15:45:00Z',
      details: {
        author: 'dev_charlie',
        prNumber: 145,
        prUrl: 'https://github.com/SolFoundry/solfoundry/pull/145',
      },
    },
    {
      stage: 'ai_review',
      status: 'current',
      date: '2024-01-10T08:30:00Z',
      details: {
        score: 4,
        verdict: 'Does not address the vulnerability. Needs significant revision.',
        submissionId: 'sub-003',
      },
    },
    {
      stage: 'approved_merged',
      status: 'pending',
      date: '',
      details: {},
    },
    {
      stage: 'paid',
      status: 'pending',
      date: '',
      details: {},
    },
  ],
};

// Bounty 5: Multiple competing PRs
export const timelineMultiplePrs: BountyTimelineData = {
  bountyId: 'b-competing-1',
  bountyTitle: 'Build Notification System',
  currentStage: 'pr_submitted',
  stages: [
    {
      stage: 'created',
      status: 'completed',
      date: '2024-01-12T09:00:00Z',
      details: {
        creator: 'SolFoundry',
      },
    },
    {
      stage: 'open_for_submissions',
      status: 'completed',
      date: '2024-01-12T09:00:00Z',
      details: {},
    },
    {
      stage: 'pr_submitted',
      status: 'current',
      date: '2024-01-13T14:00:00Z',
      details: {
        author: 'dev_alice',
        prNumber: 150,
        prUrl: 'https://github.com/SolFoundry/solfoundry/pull/150',
      },
    },
    {
      stage: 'ai_review',
      status: 'pending',
      date: '',
      details: {},
    },
    {
      stage: 'approved_merged',
      status: 'pending',
      date: '',
      details: {},
    },
    {
      stage: 'paid',
      status: 'pending',
      date: '',
      details: {},
    },
  ],
};

// Export all mock timelines for easy access
export const allMockTimelines: BountyTimelineData[] = [
  timelineEarlyStage,
  timelineMidStage,
  timelineCompleted,
  timelineRejected,
  timelineMultiplePrs,
];

// Helper function to get timeline by bounty ID
export function getTimelineByBountyId(bountyId: string): BountyTimelineData | undefined {
  return allMockTimelines.find(t => t.bountyId === bountyId);
}