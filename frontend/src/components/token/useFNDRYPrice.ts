import React, { useState, useEffect, useCallback } from 'react';

export interface PriceData {
  priceUsd: string;
  priceChange: {
    h24: number;
  };
  volume: {
    h24: number;
  };
  txns: {
    h24: {
      buys: number;
      sells: number;
    };
  };
  sparkline?: number[];
  lastUpdated: number;
}

export interface UseFNDRYPriceReturn {
  data: PriceData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// FNDRY token pair on DexScreener (Solana)
const FNDRY_PAIR_ADDRESS = 'FNDRYqP5yq8QjXgNRhEqNpH7qW5JE7iV6Yk2kqEJ';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/pairs/solana';

export function useFNDRYPrice(refreshIntervalMs: number = 30000): UseFNDRYPriceReturn {
  const [data, setData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number>(Date.now());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${DEXSCREENER_API}/${FNDRY_PAIR_ADDRESS}`);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const json = await response.json();

      if (!json.pair) {
        throw new Error('No pair data found for FNDRY token');
      }

      const pair = json.pair;

      const priceData: PriceData = {
        priceUsd: pair.priceUsd || '0',
        priceChange: {
          h24: pair.priceChange?.h24 || 0,
        },
        volume: {
          h24: pair.volume?.h24 || 0,
        },
        txns: {
          h24: {
            buys: pair.txns?.h24?.buys || 0,
            sells: pair.txns?.h24?.sells || 0,
          },
        },
        sparkline: pair.sparkline || generateSparkline(pair.priceUsd),
        lastUpdated: Date.now(),
      };

      setData(priceData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching price';
      setError(message);
      console.error('[FNDRYPriceWidget] Failed to fetch price:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setTimestamp(Date.now());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, timestamp]);

  useEffect(() => {
    const interval = setInterval(fetchData, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, refreshIntervalMs]);

  return { data, loading, error, refresh };
}

// Generate a simulated sparkline from current price
function generateSparkline(price: string, points: number = 24): number[] {
  const basePrice = parseFloat(price) || 0;
  const sparkline: number[] = [];
  let current = basePrice * (1 + (Math.random() - 0.5) * 0.1);

  for (let i = 0; i < points; i++) {
    current += (Math.random() - 0.48) * basePrice * 0.02;
    current = Math.max(current, basePrice * 0.5);
    sparkline.push(parseFloat(current.toFixed(10)));
  }

  // Ensure last point matches current price
  sparkline[points - 1] = basePrice;

  return sparkline;
}
