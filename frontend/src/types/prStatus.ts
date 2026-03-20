/** PR Status Tracker types. Stage names align with `backend/app/services/webhook_processor.py`. @module prStatus */
export type PipelineStageName = 'submitted'|'ci_running'|'ai_review'|'human_review'|'approved'|'denied'|'payout';
export type StageStatus = 'pending'|'running'|'pass'|'fail'|'skipped';
export type AIScoreCategory = 'quality'|'correctness'|'security'|'completeness'|'tests';
/** Single AI score for one review dimension. */
export interface AIScore { category: AIScoreCategory; label: string; score: number; maxScore: number; details?: string; }
/** Aggregated AI review result. */
export interface AIReviewResult { overallScore: number; maxScore: number; passed: boolean; scores: AIScore[]; }
/** On-chain payout details. */
export interface PayoutDetails { amount: number; currency: string; txHash: string; network: string; paidAt: string; }
/** Single pipeline stage with optional AI review / payout sub-data. */
export interface PipelineStage {
  name: PipelineStageName; label: string; status: StageStatus;
  startedAt?: string; completedAt?: string; details?: string;
  aiReview?: AIReviewResult; payout?: PayoutDetails;
}
/** High-level PR outcome. */
export type PROutcome = 'in_progress'|'approved'|'denied'|'paid';
/** Full PR status record. */
export interface PRStatus {
  id: string; prNumber: number; prTitle: string; prUrl: string;
  repositoryName: string; bountyId: string; bountyTitle: string;
  contributorAddress: string; outcome: PROutcome; stages: PipelineStage[];
}
/** WebSocket event types. */
export type PRStatusEventType = 'stage_started'|'stage_completed'|'stage_failed'|'outcome_changed'|'payout_sent';
/** Real-time event from WebSocket. */
export interface PRStatusEvent { type: PRStatusEventType; prStatusId: string; stage?: PipelineStageName; data: Partial<PRStatus>; }
