/**
 * useTreasuryStats — Fetches tokenomics + treasury from the real backend API.
 * Falls back to defaults when unreachable so the page always renders.
 * @module hooks/useTreasuryStats
 */
import { useState, useEffect } from 'react';
import type { TokenomicsData, TreasuryStats } from '../types/tokenomics';

const API = (import.meta.env?.VITE_API_URL as string) || '';
const now = () => new Date().toISOString();

const DEF_T: TokenomicsData = { tokenName: 'FNDRY', tokenCA: 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS', totalSupply: 1e9, circulatingSupply: 0, treasuryHoldings: 0, totalDistributed: 0, totalBuybacks: 0, totalBurned: 0, feeRevenueSol: 0, lastUpdated: now(), distributionBreakdown: {} };
const DEF_TR: TreasuryStats = { solBalance: 0, fndryBalance: 0, treasuryWallet: '57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp', totalPaidOutFndry: 0, totalPaidOutSol: 0, totalPayouts: 0, totalBuybackAmount: 0, totalBuybacks: 0, lastUpdated: now() };

/** Fetch tokenomics and treasury data from the real backend API. */
export function useTreasuryStats() {
  const [tokenomics, setTokenomics] = useState<TokenomicsData>(DEF_T);
  const [treasury, setTreasury] = useState<TreasuryStats>(DEF_TR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [tRes, trRes] = await Promise.all([fetch(`${API}/api/payouts/tokenomics`), fetch(`${API}/api/payouts/treasury`)]);
        if (!c && tRes.ok && trRes.ok) { setTokenomics(await tRes.json()); setTreasury(await trRes.json()); }
      } catch (e: unknown) { if (!c) setError(e instanceof Error ? e.message : 'Failed to load'); }
      finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, []);

  return { tokenomics, treasury, loading, error };
}
