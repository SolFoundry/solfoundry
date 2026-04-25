// Multi-LLM Review Types

export interface LLMReview {
  id: string;
  llmProvider: 'claude' | 'codex' | 'gemini';
  score: number;
  reasoning: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewConsensus {
  averageScore: number;
  agreementLevel: 'high' | 'medium' | 'low';
  scores: number[];
  disagreements: string[];
}

export interface Appeal {
  id: string;
  submissionId: string;
  reviewerId: string;
  reason: string;
  status: 'pending' | 'under_review' | 'resolved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  history: AppealHistory[];
}

export interface AppealHistory {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  notes?: string;
}

export interface ReviewDashboard {
  submissionId: string;
  reviews: LLMReview[];
  consensus: ReviewConsensus;
  appeal?: Appeal;
}
