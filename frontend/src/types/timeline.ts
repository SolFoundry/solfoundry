/**
 * Timeline Types for Bounty Lifecycle
 */

export type TimelineStageStatus = 'completed' | 'current' | 'pending';

export type TimelineStageType = 
  | 'created'
  | 'open_for_submissions'
  | 'pr_submitted'
  | 'ai_review'
  | 'approved_merged'
  | 'paid';

export interface TimelineStage {
  stage: TimelineStageType;
  status: TimelineStageStatus;
  date: string;
  details: TimelineStageDetails;
  isExpanded?: boolean;
}

export interface TimelineStageDetails {
  // For 'created' stage
  creator?: string;
  
  // For 'pr_submitted' stage
  author?: string;
  prNumber?: number;
  prUrl?: string;
  
  // For 'ai_review' stage
  score?: number;
  verdict?: string;
  submissionId?: string;
  
  // For 'approved_merged' stage
  mergedPrNumber?: number;
  mergedPrUrl?: string;
  
  // For 'paid' stage
  amount?: number;
  recipient?: string;
  txHash?: string;
  txUrl?: string;
}

export interface BountyTimelineData {
  bountyId: string;
  bountyTitle: string;
  currentStage: TimelineStageType;
  stages: TimelineStage[];
}

/**
 * Helper function to get stage display info
 */
export const STAGE_INFO: Record<TimelineStageType, { label: string; icon: string; order: number }> = {
  created: { label: 'Created', icon: '📝', order: 1 },
  open_for_submissions: { label: 'Open for Submissions', icon: '🏷️', order: 2 },
  pr_submitted: { label: 'PR Submitted', icon: '🔀', order: 3 },
  ai_review: { label: 'AI Review', icon: '🤖', order: 4 },
  approved_merged: { label: 'Approved & Merged', icon: '✅', order: 5 },
  paid: { label: 'Paid', icon: '💰', order: 6 },
};