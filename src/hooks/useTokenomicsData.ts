import { useState, useEffect } from 'react';

export interface TreasuryStats {
  totalValue: number;
  assets: {
    name: string;
    value: number;
    percentage: number;
  }[];
  lastUpdated: string;
}

export interface SupplyData {
  totalSupply: number;
  circulatingSupply: number;
  burnedTokens: number;
  lockedTokens: number;
  maxSupply: number;
  lastUpdated: string;
}

export interface TokenMetrics {
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  fullyDilutedValuation: number;
  lastUpdated: string;
}

export interface TokenomicsData {
  treasuryStats: TreasuryStats | null;
  supplyData: SupplyData | null;
  tokenMetrics: TokenMetrics | null;
  isLoading: boolean;
  error: string | null;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.example.com';

export const useTokenomicsData = (): TokenomicsData => {
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null);
  const [supplyData, setSupplyData] = useState<SupplyData | null>(null);
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTreasuryStats = async (): Promise<TreasuryStats> => {
    const response = await fetch(`${API_BASE_URL}/treasury/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch treasury stats');
    }
    return response.json();
  };

  const fetchSupplyData = async (): Promise<SupplyData> => {
    const response = await fetch(`${API_BASE_URL}/token/supply`);
    if (!response.ok) {
      throw new Error('Failed to fetch supply data');
    }
    return response.json();
  };

  const fetchTokenMetrics = async (): Promise<TokenMetrics> => {
    const response = await fetch(`${API_BASE_URL}/token/metrics`);
    if (!response.ok) {
      throw new Error('Failed to fetch token metrics');
    }
    return response.json();
  };

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [treasuryData, supplyDataResult, tokenMetricsResult] = await Promise.all([
        fetchTreasuryStats(),
        fetchSupplyData(),
        fetchTokenMetrics(),
      ]);

      setTreasuryStats(treasuryData);
      setSupplyData(supplyDataResult);
      setTokenMetrics(tokenMetricsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Set up polling interval to refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchAllData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    treasuryStats,
    supplyData,
    tokenMetrics,
    isLoading,
    error,
  };
};