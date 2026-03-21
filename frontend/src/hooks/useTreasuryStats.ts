/** Tokenomics + treasury via apiClient with error surfacing. @module hooks/useTreasuryStats */
import { useState, useEffect } from 'react';
import type { TokenomicsData, TreasuryStats } from '../types/tokenomics';
import { apiClient } from '../services/apiClient';

const now = () => new Date().toISOString();
const DEF_T: TokenomicsData = { tokenName: 'FNDRY', tokenCA: 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS', totalSupply: 1e9, circulatingSupply: 0, treasuryHoldings: 0, totalDistributed: 0, totalBuybacks: 0, totalBurned: 0, feeRevenueSol: 0, lastUpdated: now(), distributionBreakdown: {} };
const DEF_TR: TreasuryStats = { solBalance: 0, fndryBalance: 0, treasuryWallet: '57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp', totalPaidOutFndry: 0, totalPaidOutSol: 0, totalPayouts: 0, totalBuybackAmount: 0, totalBuybacks: 0, lastUpdated: now() };

/** Fetches tokenomics + treasury with error surfacing. */
export function useTreasuryStats() {
  const [tokenomics, setTokenomics] = useState<TokenomicsData>(DEF_T);
  const [treasury, setTreasury] = useState<TreasuryStats>(DEF_TR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [tD, trD] = await Promise.all([apiClient<TokenomicsData>('/api/payouts/tokenomics', { retries: 1, cacheTtl: 30_000 }), apiClient<TreasuryStats>('/api/payouts/treasury', { retries: 1, cacheTtl: 30_000 })]);
        if (!c) { setTokenomics(tD); setTreasury(trD); setError(null); }
      } catch (e: unknown) {
        if (!c) setError(e instanceof Error ? e.message : String((e as Record<string,unknown>)?.message ?? 'Failed to load'));
      } finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, []);

  return { tokenomics, treasury, loading, error };
}
