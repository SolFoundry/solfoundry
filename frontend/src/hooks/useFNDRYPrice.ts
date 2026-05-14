import { useState, useEffect, useCallback, useRef } from 'react';
import type { TokenPriceData, DexScreenerPair } from '../types/dexscreener';

/* ─── Config ─── */

// FNDRY token address on Solana (replace with actual address once deployed)
const FNDRY_TOKEN_ADDRESS = 'FNDRY_TOKEN_ADDRESS_PLACEHOLDER';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
const REFRESH_INTERVAL_MS = 30_000; // 30s refresh
const SPARKLINE_POINTS = 24; // 24 data points for sparkline

/* ─── Hook ─── */

export function useFNDRYPrice(tokenAddress?: string) {
  const [data, setData] = useState<TokenPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sparklineRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  const address = tokenAddress ?? FNDRY_TOKEN_ADDRESS;

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`${DEXSCREENER_API}/${address}`);
      if (!res.ok) throw new Error(`DexScreener API returned ${res.status}`);

      const json = await res.json();
      const pairs: DexScreenerPair[] = json.pairs ?? [];

      // Find the best pair (highest liquidity)
      const bestPair = pairs
        .filter(p => p.chainId === 'solana')
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];

      if (!bestPair) {
        // Fallback: use any pair if no Solana pair exists
        const fallback = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        if (!fallback) {
          if (mountedRef.current) setError('No trading pair found for FNDRY');
          return;
        }
        processPair(fallback);
      } else {
        processPair(bestPair);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch price');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const processPair = (pair: DexScreenerPair) => {
    const price = parseFloat(pair.priceUsd || '0');
    const change24h = pair.priceChange?.h24 ?? 0;
    const volume24h = pair.volume?.h24 ?? 0;
    const liquidity = pair.liquidity?.usd ?? 0;
    const fdv = pair.fdv ?? 0;

    // Update sparkline (append current price, keep last N points)
    sparklineRef.current = [
      ...sparklineRef.current.slice(-(SPARKLINE_POINTS - 1)),
      price,
    ];

    if (mountedRef.current) {
      setData({
        priceUsd: price,
        priceChange24h: change24h,
        volume24h,
        liquidity,
        fdv,
        sparkline: [...sparklineRef.current],
        lastUpdated: Date.now(),
      });
      setError(null);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchPrice();
    timerRef.current = setInterval(fetchPrice, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchPrice]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchPrice();
  }, [fetchPrice]);

  return { data, loading, error, refetch };
}
