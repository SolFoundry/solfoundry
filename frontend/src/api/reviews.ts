import { apiClient } from '../services/apiClient';
import type {
  LLMReviewScore,
  ReviewConsensus,
  Appeal,
  AppealTimelineEvent,
  ReviewDashboardStats,
} from '../types/review';

export interface SubmissionReviewsResponse {
  consensus: ReviewConsensus;
  reviews: LLMReviewScore[];
}

export interface AppealsListResponse {
  items: Appeal[];
  total: number;
  limit: number;
  offset: number;
}

export interface AppealCreatePayload {
  submission_id: string;
  reason: string;
  evidence: string;
  requested_action: string;
}

export interface AppealResolvePayload {
  resolution: string;
  status: 'resolved' | 'dismissed';
  reviewer_notes?: string;
}

export async function getSubmissionReviews(submissionId: string): Promise<SubmissionReviewsResponse> {
  return apiClient<SubmissionReviewsResponse>(`/api/reviews/submissions/${submissionId}`);
}

export async function getBountyReviews(bountyId: string): Promise<SubmissionReviewsResponse[]> {
  return apiClient<SubmissionReviewsResponse[]>(`/api/reviews/bounties/${bountyId}`);
}

export async function getReviewDashboardStats(): Promise<ReviewDashboardStats> {
  return apiClient<ReviewDashboardStats>('/api/reviews/stats');
}

export async function listAppeals(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<AppealsListResponse> {
  return apiClient<AppealsListResponse>('/api/reviews/appeals', {
    params: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function getAppeal(appealId: string): Promise<Appeal> {
  return apiClient<Appeal>(`/api/reviews/appeals/${appealId}`);
}

export async function createAppeal(payload: AppealCreatePayload): Promise<Appeal> {
  return apiClient<Appeal>('/api/reviews/appeals', {
    method: 'POST',
    body: payload,
  });
}

export async function resolveAppeal(
  appealId: string,
  payload: AppealResolvePayload
): Promise<Appeal> {
  return apiClient<Appeal>(`/api/reviews/appeals/${appealId}/resolve`, {
    method: 'POST',
    body: payload,
  });
}

export async function getAppealTimeline(appealId: string): Promise<AppealTimelineEvent[]> {
  return apiClient<AppealTimelineEvent[]>(`/api/reviews/appeals/${appealId}/timeline`);
}

export async function assignHumanReviewer(appealId: string): Promise<Appeal> {
  return apiClient<Appeal>(`/api/reviews/appeals/${appealId}/assign`, {
    method: 'POST',
  });
}