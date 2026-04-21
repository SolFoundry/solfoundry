/**
 * React hooks for SolFoundry SDK.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { BountyListResponse, BountyResponse, ContributorResponse, StatsResponse } from '../types.js';
import type { HttpClient } from '../client.js';

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface PaginationState {
  skip: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function createHooks(http: HttpClient) {
  function useBounties(params?: { status?: string; tier?: number; skip?: number; limit?: number }): AsyncState<BountyListResponse> & PaginationState {
    const [data, setData] = useState<BountyListResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [pagination, setPagination] = useState<PaginationState>({ skip: params?.skip ?? 0, limit: params?.limit ?? 20, total: 0, hasMore: true });
    const mountedRef = useRef(true);
    const fetch = useCallback(async () => {
      setIsLoading(true); setError(null);
      try {
        const result = await http.request<BountyListResponse>({ path: '/api/bounties', method: 'GET', params });
        if (mountedRef.current) { setData(result); setPagination(p => ({ ...p, total: (result as any).total ?? 0, hasMore: result.bounties.length >= p.limit })); }
      } catch (err) { if (mountedRef.current) setError(err instanceof Error ? err : new Error(String(err))); }
      finally { if (mountedRef.current) setIsLoading(false); }
    }, [params?.status, params?.tier, pagination.skip, pagination.limit]);
    useEffect(() => { mountedRef.current = true; fetch(); return () => { mountedRef.current = false; }; }, [fetch]);
    return { data, isLoading, error, refetch: fetch, ...pagination };
  }

  function useBounty(bountyId: string | null): AsyncState<BountyResponse> {
    const [data, setData] = useState<BountyResponse | null>(null);
    const [isLoading, setIsLoading] = useState(!!bountyId);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => {
      if (!bountyId) { setData(null); setIsLoading(false); return; }
      setIsLoading(true); setError(null);
      http.request<BountyResponse>({ path: `/api/bounties/${bountyId}`, method: 'GET' })
        .then(setData).catch(err => { if (mountedRef.current) setError(err instanceof Error ? err : new Error(String(err))); })
        .finally(() => { if (mountedRef.current) setIsLoading(false); });
      return () => { mountedRef.current = false; };
    }, [bountyId]);
    return { data, isLoading, error, refetch: () => setData(null) };
  }

  function useContributor(username: string | null): AsyncState<ContributorResponse> {
    const [data, setData] = useState<ContributorResponse | null>(null);
    const [isLoading, setIsLoading] = useState(!!username);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => {
      if (!username) { setData(null); setIsLoading(false); return; }
      setIsLoading(true); setError(null);
      http.request<ContributorResponse>({ path: `/api/contributors/${username}`, method: 'GET' })
        .then(setData).catch(err => { if (mountedRef.current) setError(err instanceof Error ? err : new Error(String(err))); })
        .finally(() => { if (mountedRef.current) setIsLoading(false); });
      return () => { mountedRef.current = false; };
    }, [username]);
    return { data, isLoading, error, refetch: () => setData(null) };
  }

  function useStats(): AsyncState<StatsResponse> {
    const [data, setData] = useState<StatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);
    const fetch = useCallback(async () => {
      setIsLoading(true); setError(null);
      try { const result = await http.request<StatsResponse>({ path: '/api/stats', method: 'GET' }); if (mountedRef.current) setData(result); }
      catch (err) { if (mountedRef.current) setError(err instanceof Error ? err : new Error(String(err))); }
      finally { if (mountedRef.current) setIsLoading(false); }
    }, []);
    useEffect(() => { mountedRef.current = true; fetch(); return () => { mountedRef.current = false; }; }, [fetch]);
    return { data, isLoading, error, refetch: fetch };
  }

  return { useBounties, useBounty, useContributor, useStats };
}
export { createHooks as default };
