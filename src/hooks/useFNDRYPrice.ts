import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DexScreenerPair,
  FNDRYPriceData,
  FNDRYPriceHookOptions,
  FNDRYPriceHookResult,
  PricePoint,
} from '../types';

const DEFAULT_CHAIN_ID = 'solana';
const DEFAULT_TOKEN_ADDRESS = '2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL';
const DEFAULT_UPDATE_INTERVAL = 30_000;
const DEFAULT_MAX_HISTORY = 20;
const MIN_UPDATE_INTERVAL = 10_000;

function getBestPair(pairs: DexScreenerPair[], chainId: string): DexScreenerPair | null {
  return [...pairs]
    .filter((pair) => pair.chainId === chainId && pair.priceUsd)
    .sort((left, right) => {
      const liquidityDelta = (right.liquidity?.usd ?? 0) - (left.liquidity?.usd ?? 0);
      if (liquidityDelta !== 0) {
        return liquidityDelta;
      }

      return (right.volume?.h24 ?? 0) - (left.volume?.h24 ?? 0);
    })[0] ?? null;
}

function mergeHistory(history: PricePoint[], priceUsd: number, maxHistoryPoints: number): PricePoint[] {
  const nextPoint: PricePoint = {
    timestamp: Date.now(),
    value: priceUsd,
  };

  const previousPoint = history[history.length - 1];
  const shouldReplacePrevious =
    previousPoint &&
    previousPoint.value === nextPoint.value &&
    nextPoint.timestamp - previousPoint.timestamp < 5_000;

  const nextHistory = shouldReplacePrevious ? [...history.slice(0, -1), nextPoint] : [...history, nextPoint];
  return nextHistory.slice(-maxHistoryPoints);
}

async function fetchTokenPairs(
  chainId: string,
  tokenAddress: string,
  signal: AbortSignal,
): Promise<DexScreenerPair[]> {
  const response = await fetch(`https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`, {
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (response.status === 429) {
    const error = new Error('DexScreener rate limit exceeded. Retrying shortly.');
    error.name = 'RateLimitError';
    throw error;
  }

  if (!response.ok) {
    throw new Error(`DexScreener request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as DexScreenerPair[];
  return Array.isArray(payload) ? payload : [];
}

export function useFNDRYPrice(options: FNDRYPriceHookOptions = {}): FNDRYPriceHookResult {
  const {
    tokenAddress = DEFAULT_TOKEN_ADDRESS,
    chainId = DEFAULT_CHAIN_ID,
    updateInterval = DEFAULT_UPDATE_INTERVAL,
    maxHistoryPoints = DEFAULT_MAX_HISTORY,
  } = options;

  const effectiveInterval = Math.max(updateInterval, MIN_UPDATE_INTERVAL);
  const [data, setData] = useState<FNDRYPriceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const retryTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const loadPrice = useCallback(async () => {
    clearRetryTimeout();
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setError(null);
    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    }

    try {
      const pairs = await fetchTokenPairs(chainId, tokenAddress, controller.signal);
      const bestPair = getBestPair(pairs, chainId);

      if (!bestPair?.priceUsd) {
        throw new Error('FNDRY pair data is unavailable right now.');
      }

      const priceUsd = Number.parseFloat(bestPair.priceUsd);
      if (!Number.isFinite(priceUsd)) {
        throw new Error('FNDRY pair price is invalid or unavailable.');
      }
      const priceChange24h = bestPair.priceChange?.h24 ?? 0;
      const volume24h = bestPair.volume?.h24 ?? null;
      const marketCap = bestPair.marketCap ?? null;
      const fdv = bestPair.fdv ?? null;
      const liquidityUsd = bestPair.liquidity?.usd ?? null;

      setData((current) => ({
        priceUsd,
        priceChange24h,
        volume24h,
        marketCap,
        fdv,
        liquidityUsd,
        pairAddress: bestPair.pairAddress,
        pairUrl: bestPair.url,
        dexId: bestPair.dexId,
        baseSymbol: bestPair.baseToken.symbol,
        quoteSymbol: bestPair.quoteToken.symbol,
        updatedAt: Date.now(),
        history: mergeHistory(current?.history ?? [], priceUsd, maxHistoryPoints),
      }));
      setError(null);
      hasLoadedRef.current = true;
    } catch (caughtError) {
      if ((caughtError as Error).name === 'AbortError') {
        return;
      }

      const nextMessage =
        caughtError instanceof Error ? caughtError.message : 'Unable to load FNDRY price data.';

      setError(nextMessage);
      retryTimeoutRef.current = window.setTimeout(() => {
        void loadPrice();
      }, Math.min(effectiveInterval, 15_000));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [chainId, clearRetryTimeout, effectiveInterval, maxHistoryPoints, tokenAddress]);

  useEffect(() => {
    setIsLoading(true);
    void loadPrice();

    const intervalId = window.setInterval(() => {
      void loadPrice();
    }, effectiveInterval);

    return () => {
      window.clearInterval(intervalId);
      clearRetryTimeout();
      abortControllerRef.current?.abort();
    };
  }, [clearRetryTimeout, effectiveInterval, loadPrice]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    retry: loadPrice,
  };
}
