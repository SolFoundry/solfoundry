export type LLMVendor = "Claude" | "Codex" | "Gemini";

export interface ReviewDimension {
  key: string;
  label: string;
  score: number;
}

export interface ModelReview {
  model: LLMVendor;
  score: number;
  confidence: number;
  recommendation: "approve" | "revise" | "reject";
  reasoning: string;
  strengths: string[];
  concerns: string[];
  dimensions: ReviewDimension[];
}

export interface ConsensusMetrics {
  averageScore: number;
  scoreSpread: number;
  agreementLevel: "strong" | "moderate" | "weak";
  consensusScore: number;
  primaryRecommendation: "approve" | "revise" | "reject";
  conflictingModels: LLMVendor[];
}

export interface DisagreementAnalysis {
  headline: string;
  severity: "low" | "medium" | "high";
  summary: string;
  scoreDelta: number;
  recommendationSplit: boolean;
  hotspots: string[];
  suggestedResolution: string;
}

export interface AppealEvent {
  id: string;
  timestamp: string;
  actor: string;
  type:
    | "submitted"
    | "assigned"
    | "commented"
    | "resolved"
    | "reopened";
  note: string;
}

export interface Reviewer {
  id: string;
  name: string;
  specialty: string;
  activeAppeals: number;
  capacity: number;
}

export interface AppealRecord {
  id: string;
  reviewId: string;
  appellant: string;
  reason: string;
  status: "pending" | "assigned" | "under_review" | "resolved";
  priority: "normal" | "high" | "critical";
  requestedAt: string;
  assignedReviewerId?: string;
  resolution?: {
    outcome: "upheld" | "overturned" | "partial";
    summary: string;
    resolvedAt: string;
  };
  history: AppealEvent[];
}

export interface ReviewRecord {
  id: string;
  submissionTitle: string;
  submitter: string;
  category: string;
  submittedAt: string;
  llmReviews: ModelReview[];
  consensus: ConsensusMetrics;
  disagreement: DisagreementAnalysis;
  currentAppeal?: AppealRecord;
}

export interface AppealAnalytics {
  totalAppeals: number;
  openAppeals: number;
  resolvedAppeals: number;
  overturnRate: number;
  averageResolutionHours: number;
  byOutcome: Array<{ label: string; value: number }>;
  byPriority: Array<{ label: string; value: number }>;
}

export interface DashboardPayload {
  reviews: ReviewRecord[];
  appeals: AppealRecord[];
  reviewers: Reviewer[];
  analytics: AppealAnalytics;
}

export interface CreateAppealInput {
  reviewId: string;
  appellant: string;
  reason: string;
  priority: AppealRecord["priority"];
}

export interface AssignAppealInput {
  reviewerId: string;
  note: string;
}

export interface ResolveAppealInput {
  outcome: NonNullable<AppealRecord["resolution"]>["outcome"];
  summary: string;
  actor: string;
}
