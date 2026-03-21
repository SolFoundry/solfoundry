/**
 * Tokenomics + treasury via apiClient + React Query.
 * @module hooks/useTreasuryStats
 */
import { useQuery } from '@tanstack/react-query';
import type { TokenomicsData, TreasuryStats } from '../types/tokenomics';
import { apiClient } from '../services/apiClient';

const now = () => new Date().toISOString();
/** Empty-state tokenomics when API is unreachable. */
const DEFAULT_TOKENOMICS: TokenomicsData = { tokenName: 'FNDRY', tokenCA: 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS', totalSupply: 1e9, circulatingSupply: 0, treasuryHoldings: 0, totalDistributed: 0, totalBuybacks: 0, totalBurned: 0, feeRevenueSol: 0, lastUpdated: now(), distributionBreakdown: {} };
/** Empty-state treasury when API is unreachable. */
const DEFAULT_TREASURY: TreasuryStats = { solBalance: 0, fndryBalance: 0, treasuryWallet: '57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp', totalPaidOutFndry: 0, totalPaidOutSol: 0, totalPayouts: 0, totalBuybackAmount: 0, totalBuybacks: 0, lastUpdated: now() };

/** Fetch both tokenomics and treasury in parallel. */
async function fetchTreasuryData() {
  const [tokenomicsData, treasuryData] = await Promise.all([
    apiClient<TokenomicsData>('/api/payouts/tokenomics', { retries: 1 }),
    apiClient<TreasuryStats>('/api/payouts/treasury', { retries: 1 }),
  ]);
  return { tokenomics: tokenomicsData, treasury: treasuryData };
}

/** Fetches and caches tokenomics + treasury stats via React Query. */
export function useTreasuryStats() {
  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['treasury'],
    queryFn: fetchTreasuryData,
    staleTime: 30_000,
  });

  const tokenomics = data?.tokenomics ?? DEFAULT_TOKENOMICS;
  const treasury = data?.treasury ?? DEFAULT_TREASURY;
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load treasury data') : null;

  return { tokenomics, treasury, loading, error };
}
