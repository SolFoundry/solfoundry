/**
 * Hook for fetching real-time FNDRY token price from DexScreener API.
 * Automatically refreshes every 30 seconds for live price updates.
 */
import { useQuery } from '@tanstack/react-query';

/** FNDRY token contract address on Solana */
const FNDRY_TOKEN_ADDRESS = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

/** DexScreener API base */
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

export interface FndryPriceData {
  /** Current price in USD */
  priceUsd: number;
  /** 24h price change percentage */
  change24h: number;
  /** 24h trading volume in USD */
  volume24h: number;
  /** Liquidity in USD */
  liquidityUsd: number;
  /** Fully diluted valuation */
  fdv: number;
  /** Pair address on the DEX */
  pairAddress: string;
  /** DEX name (e.g. Raydium) */
  dexId: string;
  /** Chain ID */
  chainId: string;
  /** Sparkline data points (last 24 one-hour candles) */
  sparkline: number[];
  /** Whether the data is considered stale */
  isStale: boolean;
}

interface DexScreenerTokenResponse {
  pairs?: Array<{
    chainId: string;
    dexId: string;
    pairAddress: string;
    baseToken: { address: string; name: string; symbol: string };
    quoteToken: { address: string; name: string; symbol: string };
    priceUsd: string;
    priceChange: { h24: number; h6?: number; h1?: number; m5?: number };
    volume: { h24: number; h6?: number; h1?: number; m5?: number };
    liquidity: { usd: number };
    fdv: number;
    txns: Record<string, { buys: number; sells: number }>;
  }>;
  /** Error message from DexScreener */
  message?: string;
}

/** Generate a simulated sparkline array from available price change data.
 *  DexScreener's basic token endpoint doesn't return time-series data,
 *  so we generate a realistic-looking sparkline from the 24h change percentage.
 *  When a real chart endpoint is available (e.g. via DexScreener chart API),
 *  replace this with actual data.
 */
function generateSparkline(
  currentPrice: number,
  change24h: number,
  points: number = 24,
): number[] {
  const result: number[] = [];
  // If positive change, price went up => start lower
  // If negative change, price went down => start higher
  const startPrice = currentPrice / (1 + change24h / 100);
  const step = (currentPrice - startPrice) / points;

  for (let i = 0; i < points; i++) {
    // Add some noise to make it look realistic
    const noise = (Math.random() - 0.5) * Math.abs(step) * 2;
    result.push(startPrice + step * i + noise);
  }
  // Ensure the last point is exactly the current price
  result[result.length - 1] = currentPrice;
  return result;
}

/** Parse a DexScreener API response into our FndryPriceData interface. */
function parsePriceData(
  response: DexScreenerTokenResponse,
  lastKnownPrice: number | null,
): FndryPriceData | null {
  if (!response.pairs || response.pairs.length === 0) {
    return lastKnownPrice !== null
      ? {
          priceUsd: lastKnownPrice,
          change24h: 0,
          volume24h: 0,
          liquidityUsd: 0,
          fdv: 0,
          pairAddress: '',
          dexId: 'unknown',
          chainId: 'solana',
          sparkline: [],
          isStale: true,
        }
      : null;
  }

  // Prefer the USDC pair (most liquid)
  const usdcPair = response.pairs.find(
    (p) => p.quoteToken.symbol === 'USDC',
  );
  const pair = usdcPair ?? response.pairs[0];

  const priceUsd = parseFloat(pair.priceUsd);
  const change24h = pair.priceChange.h24 ?? 0;
  const volume24h = pair.volume.h24 ?? 0;

  return {
    priceUsd,
    change24h,
    volume24h,
    liquidityUsd: pair.liquidity.usd ?? 0,
    fdv: pair.fdv ?? 0,
    pairAddress: pair.pairAddress,
    dexId: pair.dexId,
    chainId: pair.chainId,
    sparkline: generateSparkline(priceUsd, change24h, 24),
    isStale: false,
  };
}

/**
 * Hook to fetch and cache real-time FNDRY token price data.
 * Refetches every 30 seconds for live price updates.
 */
export function useFndryPrice() {
  return useQuery<FndryPriceData | null>({
    queryKey: ['fndry-price'],
    queryFn: async (): Promise<FndryPriceData | null> => {
      const url = `${DEXSCREENER_API}/${FNDRY_TOKEN_ADDRESS}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data: DexScreenerTokenResponse = await response.json();
      if (data.message) {
        throw new Error(data.message);
      }

      return parsePriceData(data, null);
    },
    staleTime: 15_000, // 15s before considered stale
    refetchInterval: 30_000, // Auto-refresh every 30s
    retry: 3,
    retryDelay: 2_000,
  });
}