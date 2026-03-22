/** Mock data used as fallback when the tokenomics/treasury APIs are unavailable. */
import type { TokenomicsData, TreasuryStats } from '../types/tokenomics';

/** Default $FNDRY token metrics (used during development and as API fallback). */
export const MOCK_TOKENOMICS: TokenomicsData = {
  tokenName: 'FNDRY', tokenCA: 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS',
  totalSupply: 1_000_000_000, circulatingSupply: 750_000_000, treasuryHoldings: 200_000_000,
  totalDistributed: 50_000, totalBuybacks: 10_000, totalBurned: 0, feeRevenueSol: 25.5,
  lastUpdated: new Date().toISOString(),
  distributionBreakdown: { contributor_rewards: 50_000, treasury_reserve: 200_000_000, buybacks: 10_000, burned: 0 },
};

/** Default treasury wallet stats (used during development and as API fallback). */
export const MOCK_TREASURY: TreasuryStats = {
  solBalance: 150.75, fndryBalance: 200_000_000, treasuryWallet: 'AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1',
  totalPaidOutFndry: 50_000, totalPaidOutSol: 5.2, totalPayouts: 42,
  totalBuybackAmount: 10.5, totalBuybacks: 3, lastUpdated: new Date().toISOString(),
};
