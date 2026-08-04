export type LLMProvider = 'claude' | 'codex' | 'gemini';

export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'appealed';

export type AppealStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

export interface LLMReviewScore {
  id: string;
  submission_id: string;
  provider: LLMProvider;
  score: number;
  max_score: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  criteria_scores: CriterionScore[];
  created_at: string;
}

export interface CriterionScore {
  name: string;
  score: number;
  max_score: number;
  weight: number;
}

export interface ReviewConsensus {
  submission_id: string;
  overall_score: number;
  max_score: number;
  threshold: number;
  consensus: 'pass' | 'fail' | 'disputed';
  provider_scores: LLMReviewScore[];
  disagreement_areas: Disagreement[];
  aggregated_at: string;
}

export interface Disagreement {
  criterion: string;
  provider_a: LLMProvider;
  score_a: number;
  provider_b: LLMProvider;
  score_b: number;
  gap: number;
  description: string;
}

export interface Appeal {
  id: string;
  submission_id: string;
  bounty_id: string;
  appellant_id: string;
  appellant_username: string;
  status: AppealStatus;
  reason: string;
  evidence: string;
  requested_action: string;
  assigned_human_reviewer?: string | null;
  reviewer_notes?: string | null;
  resolution?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface AppealTimelineEvent {
  id: string;
  appeal_id: string;
  event_type: 'created' | 'assigned' | 'note_added' | 'resolved' | 'dismissed' | 'reopened';
  description: string;
  created_by: string;
  created_at: string;
}

export interface ReviewDashboardStats {
  total_reviews: number;
  reviews_today: number;
  pass_rate: number;
  dispute_rate: number;
  open_appeals: number;
  avg_review_time_hours: number;
  provider_stats: ProviderStats[];
}

export interface ProviderStats {
  provider: LLMProvider;
  total_reviews: number;
  avg_score: number;
  avg_review_time_seconds: number;
}