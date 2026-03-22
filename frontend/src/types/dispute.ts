/**
 * Dispute resolution type definitions.
 *
 * Mirrors the backend Pydantic models for the dispute resolution system.
 * Used by the dispute hook, pages, and components for type-safe data flow.
 * @module types/dispute
 */

/** Valid dispute lifecycle states. */
export type DisputeStatus =
  | 'opened'
  | 'evidence'
  | 'mediation'
  | 'pending'
  | 'under_review'
  | 'resolved';

/** Possible resolution outcomes for a dispute. */
export type DisputeOutcome =
  | 'release_to_contributor'
  | 'refund_to_creator'
  | 'split'
  | 'approved'
  | 'rejected'
  | 'cancelled';

/** Valid reasons for initiating a dispute. */
export type DisputeReason =
  | 'incorrect_review'
  | 'plagiarism'
  | 'rule_violation'
  | 'technical_issue'
  | 'unfair_rejection'
  | 'other';

/** A single piece of evidence attached to a dispute. */
export interface EvidenceItem {
  evidence_type: string;
  url?: string;
  description: string;
}

/** Full dispute record returned from the API. */
export interface Dispute {
  id: string;
  bounty_id: string;
  submission_id: string;
  contributor_id: string;
  creator_id: string;
  reason: string;
  description: string;
  evidence_links: EvidenceItem[];
  status: DisputeStatus;
  outcome?: DisputeOutcome;
  ai_review_score?: number;
  ai_recommendation?: string;
  resolver_id?: string;
  resolution_notes?: string;
  reputation_impact_creator?: number;
  reputation_impact_contributor?: number;
  rejection_timestamp: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

/** Brief dispute info for list views. */
export interface DisputeListItem {
  id: string;
  bounty_id: string;
  contributor_id: string;
  reason: string;
  status: DisputeStatus;
  outcome?: DisputeOutcome;
  created_at: string;
  resolved_at?: string;
}

/** Paginated dispute list response. */
export interface DisputeListResponse {
  items: DisputeListItem[];
  total: number;
  skip: number;
  limit: number;
}

/** Audit history entry for a dispute. */
export interface DisputeHistoryItem {
  id: string;
  dispute_id: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  actor_id: string;
  notes?: string;
  created_at: string;
}

/** Full dispute detail with history timeline. */
export interface DisputeDetail extends Dispute {
  history: DisputeHistoryItem[];
}

/** Payload for creating a new dispute. */
export interface DisputeCreatePayload {
  bounty_id: string;
  submission_id: string;
  reason: DisputeReason;
  description: string;
  evidence_links: EvidenceItem[];
}

/** Payload for submitting evidence. */
export interface DisputeEvidencePayload {
  evidence_links: EvidenceItem[];
  notes?: string;
}

/** Payload for resolving a dispute (admin only). */
export interface DisputeResolvePayload {
  outcome: DisputeOutcome;
  resolution_notes: string;
}

/** Human-readable labels for dispute statuses. */
export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  opened: 'Opened',
  evidence: 'Evidence Phase',
  mediation: 'In Mediation',
  pending: 'Pending',
  under_review: 'Under Review',
  resolved: 'Resolved',
};

/** Human-readable labels for dispute outcomes. */
export const DISPUTE_OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  release_to_contributor: 'Released to Contributor',
  refund_to_creator: 'Refunded to Creator',
  split: 'Split Decision',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

/** Human-readable labels for dispute reasons. */
export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  incorrect_review: 'Incorrect Review',
  plagiarism: 'Plagiarism Claim',
  rule_violation: 'Rule Violation',
  technical_issue: 'Technical Issue',
  unfair_rejection: 'Unfair Rejection',
  other: 'Other',
};

/** Options for the reason select dropdown. */
export const DISPUTE_REASON_OPTIONS: { value: DisputeReason; label: string }[] = [
  { value: 'unfair_rejection', label: 'Unfair Rejection' },
  { value: 'incorrect_review', label: 'Incorrect Review' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'rule_violation', label: 'Rule Violation' },
  { value: 'plagiarism', label: 'Plagiarism Claim' },
  { value: 'other', label: 'Other' },
];
