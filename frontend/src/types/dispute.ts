export type DisputeState = 'opened' | 'evidence' | 'mediation' | 'resolved';
export type DisputeOutcome = 'release_to_contributor' | 'refund_to_creator' | 'split';
export type EvidenceParty = 'contributor' | 'creator';

export interface EvidenceItem {
  id: string;
  dispute_id: string;
  submitted_by: string;
  party: EvidenceParty;
  evidence_type: string;
  url?: string;
  description: string;
  extra_data: Record<string, unknown>;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  dispute_id: string;
  action: string;
  previous_state?: string;
  new_state?: string;
  actor_id: string;
  details: Record<string, unknown>;
  notes?: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  bounty_id: string;
  submission_id: string;
  contributor_id: string;
  creator_id: string;
  reason: string;
  description: string;
  state: DisputeState;
  outcome?: DisputeOutcome;
  ai_review_score?: number;
  ai_review_summary?: string;
  mediation_type?: string;
  resolver_id?: string;
  resolution_notes?: string;
  split_contributor_pct?: number;
  split_creator_pct?: number;
  reputation_impact_applied: boolean;
  contributor_reputation_delta: number;
  creator_reputation_delta: number;
  evidence_deadline?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface DisputeDetail extends Dispute {
  evidence: EvidenceItem[];
  audit_trail: AuditEntry[];
}

export interface DisputeListResponse {
  items: Dispute[];
  total: number;
  skip: number;
  limit: number;
}

export const DISPUTE_REASONS: { value: string; label: string }[] = [
  { value: 'valid_submission_rejected', label: 'Valid Submission Rejected' },
  { value: 'incorrect_review', label: 'Incorrect Review' },
  { value: 'unfair_rejection', label: 'Unfair Rejection' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'other', label: 'Other' },
];

export const STATE_LABELS: Record<DisputeState, string> = {
  opened: 'Opened',
  evidence: 'Evidence Collection',
  mediation: 'Under Mediation',
  resolved: 'Resolved',
};

export const OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  release_to_contributor: 'Released to Contributor',
  refund_to_creator: 'Refunded to Creator',
  split: 'Split Between Parties',
};
