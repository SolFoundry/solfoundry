export interface TokenomicsData {
  tokenName: string; tokenCA: string; totalSupply: number; circulatingSupply: number;
  treasuryHoldings: number; totalDistributed: number; totalBuybacks: number; totalBurned: number;
  feeRevenueSol: number; lastUpdated: string;
  distributionBreakdown: Record<string, number>;
}
export interface TreasuryStats {
  solBalance: number; fndryBalance: number; treasuryWallet: string;
  totalPaidOutFndry: number; totalPaidOutSol: number; totalPayouts: number;
  totalBuybackAmount: number; totalBuybacks: number; lastUpdated: string;
}
