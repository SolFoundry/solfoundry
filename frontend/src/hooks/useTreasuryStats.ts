import { useState, useEffect } from 'react';
import type { TokenomicsData, TreasuryStats } from '../types/tokenomics';
import { MOCK_TOKENOMICS, MOCK_TREASURY } from '../data/mockTokenomics';

/**
 * Fetches live tokenomics and treasury data from `/api/tokenomics` and `/api/treasury`.
 * Falls back to {@link MOCK_TOKENOMICS} / {@link MOCK_TREASURY} when the API is unreachable
 * or returns a non-OK status, so the page always renders meaningful data.
 */
export function useTreasuryStats() {
  const [tokenomics, setTokenomics] = useState<TokenomicsData>(MOCK_TOKENOMICS);
  const [treasury, setTreasury] = useState<TreasuryStats>(MOCK_TREASURY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tRes, trRes] = await Promise.all([fetch('/api/tokenomics'), fetch('/api/treasury')]);
        if (!cancelled && tRes.ok && trRes.ok) {
          setTokenomics(await tRes.json()); setTreasury(await trRes.json());
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return { tokenomics, treasury, loading, error };
}
