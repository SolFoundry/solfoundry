import { useQuery } from '@tanstack/react-query';
import {
  getSubmissionReviews,
  getBountyReviews,
  getReviewDashboardStats,
  listAppeals,
  getAppeal,
  getAppealTimeline,
} from '../api/reviews';
import type { AppealStatus } from '../types/review';

export function useSubmissionReviews(submissionId: string | undefined) {
  return useQuery({
    queryKey: ['submission-reviews', submissionId],
    queryFn: () => getSubmissionReviews(submissionId!),
    enabled: !!submissionId,
    staleTime: 30_000,
  });
}

export function useBountyReviews(bountyId: string | undefined) {
  return useQuery({
    queryKey: ['bounty-reviews', bountyId],
    queryFn: () => getBountyReviews(bountyId!),
    enabled: !!bountyId,
    staleTime: 30_000,
  });
}

export function useReviewDashboardStats() {
  return useQuery({
    queryKey: ['review-dashboard-stats'],
    queryFn: () => getReviewDashboardStats(),
    staleTime: 30_000,
  });
}

export function useAppeals(params?: { status?: AppealStatus; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['appeals', params],
    queryFn: () => listAppeals(params),
    staleTime: 30_000,
  });
}

export function useAppeal(appealId: string | undefined) {
  return useQuery({
    queryKey: ['appeal', appealId],
    queryFn: () => getAppeal(appealId!),
    enabled: !!appealId,
    staleTime: 30_000,
  });
}

export function useAppealTimeline(appealId: string | undefined) {
  return useQuery({
    queryKey: ['appeal-timeline', appealId],
    queryFn: () => getAppealTimeline(appealId!),
    enabled: !!appealId,
    staleTime: 30_000,
  });
}