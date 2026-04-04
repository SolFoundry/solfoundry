/**
 * useReviewScores / useAppeal — hooks for the multi-LLM review dashboard.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types (exported for tests + components)
// ---------------------------------------------------------------------------

export interface ReviewScore {
  reviewer: string;           // 'claude' | 'codex' | 'gemini'
  score: number;              // 0–10
  reasoning: string;
  model_id: string;
  reviewed_at: string;
}

export interface AppealHistoryEntry {
  id: string;
  action: string;
  actor: string;
  note: string;
  created_at: string;
}

export interface Appeal {
  id: string;
  submission_id: string;
  status: 'pending' | 'assigned' | 'reviewing' | 'resolved' | 'dismissed';
  reason: string;
  filed_at: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  resolution: string | null;
  resolved_at: string | null;
  history: AppealHistoryEntry[];
}

// ---------------------------------------------------------------------------
// useReviewScores
// ---------------------------------------------------------------------------

async function fetchReviewScores(submissionId: string): Promise<ReviewScore[]> {
  const res = await fetch(`/api/submissions/${submissionId}/review-scores`);
  if (!res.ok) throw new Error('Failed to load review scores');
  return res.json();
}

export function useReviewScores(submissionId: string) {
  const { data, isLoading, error } = useQuery<ReviewScore[], Error>({
    queryKey: ['review-scores', submissionId],
    queryFn: () => fetchReviewScores(submissionId),
    staleTime: 60_000,
  });
  return { scores: data ?? [], isLoading, error: error ?? null };
}

// ---------------------------------------------------------------------------
// useAppeal
// ---------------------------------------------------------------------------

async function fetchAppeal(submissionId: string): Promise<Appeal | null> {
  const res = await fetch(`/api/submissions/${submissionId}/appeal`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load appeal');
  return res.json();
}

async function postAppeal(submissionId: string, payload: { reason: string }): Promise<Appeal> {
  const res = await fetch(`/api/submissions/${submissionId}/appeal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to file appeal');
  return res.json();
}

export function useAppeal(submissionId: string) {
  const qc = useQueryClient();

  const { data: appeal, isLoading } = useQuery<Appeal | null, Error>({
    queryKey: ['appeal', submissionId],
    queryFn: () => fetchAppeal(submissionId),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (payload: { reason: string }) => postAppeal(submissionId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appeal', submissionId] }),
  });

  return {
    appeal: appeal ?? null,
    fileAppeal: mutation.mutate,
    isLoading: isLoading || mutation.isPending,
  };
}
