import { useState, useCallback } from 'react';
import type { BountySubmission, AggregatedReviewScore, LifecycleLogEntry } from '../types/bounty';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useBountySubmission(bountyId: string) {
  const [submissions, setSubmissions] = useState<BountySubmission[]>([]);
  const [reviewScores, setReviewScores] = useState<Record<string, AggregatedReviewScore>>({});
  const [lifecycle, setLifecycle] = useState<LifecycleLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/submissions`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (e) {
      console.error('Failed to fetch submissions', e);
    }
  }, [bountyId]);

  const submitSolution = useCallback(async (prUrl: string, wallet: string, notes?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/submissions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          pr_url: prUrl,
          contributor_wallet: wallet,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Failed to submit');
        return null;
      }
      const data = await res.json();
      setSubmissions(prev => [...prev, data]);
      return data as BountySubmission;
    } catch (e: any) {
      setError(e.message || 'Network error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [bountyId]);

  const fetchReviewScores = useCallback(async (submissionId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/bounties/${bountyId}/submissions/${submissionId}/reviews`
      );
      if (res.ok) {
        const data: AggregatedReviewScore = await res.json();
        setReviewScores(prev => ({ ...prev, [submissionId]: data }));
        return data;
      }
    } catch (e) {
      console.error('Failed to fetch review scores', e);
    }
    return null;
  }, [bountyId]);

  const approveSubmission = useCallback(async (submissionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/bounties/${bountyId}/submissions/${submissionId}/approve`,
        { method: 'POST', headers: getAuthHeaders() }
      );
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Failed to approve');
        return null;
      }
      const data = await res.json();
      setSubmissions(prev => prev.map(s => (s.id === submissionId ? data : s)));
      return data as BountySubmission;
    } catch (e: any) {
      setError(e.message || 'Network error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [bountyId]);

  const disputeSubmission = useCallback(async (submissionId: string, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/bounties/${bountyId}/submissions/${submissionId}/dispute`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Failed to dispute');
        return null;
      }
      const data = await res.json();
      setSubmissions(prev => prev.map(s => (s.id === submissionId ? data : s)));
      return data as BountySubmission;
    } catch (e: any) {
      setError(e.message || 'Network error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [bountyId]);

  const fetchLifecycle = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/lifecycle`);
      if (res.ok) {
        const data = await res.json();
        setLifecycle(data.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch lifecycle', e);
    }
  }, [bountyId]);

  return {
    submissions,
    reviewScores,
    lifecycle,
    loading,
    error,
    fetchSubmissions,
    submitSolution,
    fetchReviewScores,
    approveSubmission,
    disputeSubmission,
    fetchLifecycle,
  };
}
