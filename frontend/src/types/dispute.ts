export interface DisputeListItem {
  id: string;
  bounty_id: string;
  contributor_id: string;
  reason: string;
  status: 'opened' | 'evidence' | 'mediation' | 'resolved' | 'closed';
  outcome?: 'release_to_contributor' | 'return_to_poster' | 'partial_release' | 'dismissed';
  created_at: string;
  resolved_at?: string;
}

export interface DisputeHistoryItem {
  id: string;
  dispute_id: string;
  action: string;
  previous_status?: string;
  new_status: string;
  actor_id: string;
  notes?: string;
  created_at: string;
}

export interface EvidenceLink {
  evidence_type: string;
  url: string;
  description: string;
}

export interface EvidenceSubmission {
  evidence_links: EvidenceLink[];
}
