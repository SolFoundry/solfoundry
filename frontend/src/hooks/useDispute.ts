/**
 * React hook for dispute resolution operations.
 *
 * Provides data fetching, state management, and mutation functions
 * for the dispute resolution system. Communicates with the backend
 * dispute API endpoints.
 * @module hooks/useDispute
 */

import { useState, useCallback } from 'react';
import type {
  Dispute,
  DisputeDetail,
  DisputeListItem,
  DisputeCreatePayload,
  DisputeEvidencePayload,
  DisputeResolvePayload,
} from '../types/dispute';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

/** Build authentication headers from stored auth token. */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const userId = localStorage.getItem('user_id');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userId ? { 'X-User-ID': userId } : {}),
  };
}

/** Return type for the useDispute hook. */
export interface UseDisputeReturn {
  /** List of disputes for the current view. */
  disputes: DisputeListItem[];
  /** Currently selected dispute detail (with history). */
  disputeDetail: DisputeDetail | null;
  /** Loading state for any async operation. */
  loading: boolean;
  /** Error message from the last failed operation. */
  error: string | null;
  /** Total disputes available (for pagination). */
  total: number;
  /** Fetch a paginated list of disputes with optional filters. */
  fetchDisputes: (params?: {
    status?: string;
    bountyId?: string;
    skip?: number;
    limit?: number;
  }) => Promise<void>;
  /** Fetch a single dispute by ID with full detail and history. */
  fetchDisputeDetail: (disputeId: string) => Promise<DisputeDetail | null>;
  /** Create a new dispute on a rejected submission. */
  createDispute: (payload: DisputeCreatePayload) => Promise<Dispute | null>;
  /** Submit additional evidence for a dispute. */
  submitEvidence: (
    disputeId: string,
    payload: DisputeEvidencePayload,
  ) => Promise<Dispute | null>;
  /** Trigger AI mediation on a dispute. */
  requestMediation: (disputeId: string) => Promise<Dispute | null>;
  /** Admin-only: resolve a dispute with an outcome. */
  resolveDispute: (
    disputeId: string,
    payload: DisputeResolvePayload,
  ) => Promise<Dispute | null>;
  /** Clear the current error state. */
  clearError: () => void;
}

/**
 * Hook for managing dispute resolution state and operations.
 *
 * Handles all CRUD operations for the dispute lifecycle including
 * creation, evidence submission, mediation, and resolution.
 *
 * @returns Object with dispute state and mutation functions.
 */
export function useDispute(): UseDisputeReturn {
  const [disputes, setDisputes] = useState<DisputeListItem[]>([]);
  const [disputeDetail, setDisputeDetail] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const clearError = useCallback(() => setError(null), []);

  const fetchDisputes = useCallback(
    async (params?: {
      status?: string;
      bountyId?: string;
      skip?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set('status', params.status);
        if (params?.bountyId) searchParams.set('bounty_id', params.bountyId);
        if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
        if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));

        const queryString = searchParams.toString();
        const url = `${API_BASE}/api/disputes${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, { headers: getAuthHeaders() });
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || errorData.message || 'Failed to fetch disputes');
          return;
        }

        const data = await response.json();
        setDisputes(data.items || []);
        setTotal(data.total || 0);
      } catch (networkError: unknown) {
        const message = networkError instanceof Error ? networkError.message : 'Network error';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchDisputeDetail = useCallback(
    async (disputeId: string): Promise<DisputeDetail | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE}/api/disputes/${disputeId}`,
          { headers: getAuthHeaders() },
        );
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || errorData.message || 'Failed to fetch dispute');
          return null;
        }

        const data: DisputeDetail = await response.json();
        setDisputeDetail(data);
        return data;
      } catch (networkError: unknown) {
        const message = networkError instanceof Error ? networkError.message : 'Network error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createDispute = useCallback(
    async (payload: DisputeCreatePayload): Promise<Dispute | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/disputes`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || errorData.message || 'Failed to create dispute');
          return null;
        }

        const data: Dispute = await response.json();
        return data;
      } catch (networkError: unknown) {
        const message = networkError instanceof Error ? networkError.message : 'Network error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const submitEvidence = useCallback(
    async (
      disputeId: string,
      payload: DisputeEvidencePayload,
    ): Promise<Dispute | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE}/api/disputes/${disputeId}/evidence`,
          {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || errorData.message || 'Failed to submit evidence');
          return null;
        }

        const data: Dispute = await response.json();
        return data;
      } catch (networkError: unknown) {
        const message = networkError instanceof Error ? networkError.message : 'Network error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const requestMediation = useCallback(
    async (disputeId: string): Promise<Dispute | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE}/api/disputes/${disputeId}/mediate`,
          {
            method: 'POST',
            headers: getAuthHeaders(),
          },
        );
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || errorData.message || 'Failed to request mediation');
          return null;
        }

        const data: Dispute = await response.json();
        return data;
      } catch (networkError: unknown) {
        const message = networkError instanceof Error ? networkError.message : 'Network error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const resolveDispute = useCallback(
    async (
      disputeId: string,
      payload: DisputeResolvePayload,
    ): Promise<Dispute | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE}/api/disputes/${disputeId}/resolve`,
          {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || errorData.message || 'Failed to resolve dispute');
          return null;
        }

        const data: Dispute = await response.json();
        return data;
      } catch (networkError: unknown) {
        const message = networkError instanceof Error ? networkError.message : 'Network error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    disputes,
    disputeDetail,
    loading,
    error,
    total,
    fetchDisputes,
    fetchDisputeDetail,
    createDispute,
    submitEvidence,
    requestMediation,
    resolveDispute,
    clearError,
  };
}
