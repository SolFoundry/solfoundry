import { useEffect, useMemo, useState } from 'react';

type TokenPriceMode = 'compact' | 'full';

interface TokenPriceData {
  priceUsd: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
}

interface DexScreenerPair {
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  volume?: {
    h24?: number;
  };
  priceChange?: {
    h24?: number;
  };
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

export interface TokenPriceProps {
  mode?: TokenPriceMode;
  className?: string;
  refreshMs?: number;
}

const TOKEN_ADDRESS = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`;
const DEFAULT_REFRESH_MS = 60_000;

function formatPrice(value: number) {
  const fractionDigits = Math.abs(value) >= 1 ? 2 : 4;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatChange(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function parseDexScreenerResponse(data: DexScreenerResponse): TokenPriceData {
  const pair = data.pairs?.[0];
  if (!pair || !pair.priceUsd) {
    throw new Error('Price unavailable');
  }

  return {
    priceUsd: Number(pair.priceUsd),
    priceChange24h: pair.priceChange?.h24 ?? 0,
    marketCap: pair.marketCap ?? pair.fdv ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
  };
}

export function TokenPrice({ mode = 'compact', className = '', refreshMs = DEFAULT_REFRESH_MS }: TokenPriceProps) {
  const [data, setData] = useState<TokenPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchTokenPrice = async () => {
      try {
        const response = await fetch(DEXSCREENER_URL);
        if (!response.ok) {
          throw new Error('Price unavailable');
        }

        const parsed = parseDexScreenerResponse(await response.json());
        if (mounted) {
          setData(parsed);
          setError(false);
        }
      } catch {
        if (mounted) {
          setError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchTokenPrice();
    const intervalId = window.setInterval(fetchTokenPrice, refreshMs);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [refreshMs]);

  const changeClasses = useMemo(() => {
    if (!data) {
      return 'text-gray-400';
    }
    if (data.priceChange24h > 0) {
      return 'text-emerald-400';
    }
    if (data.priceChange24h < 0) {
      return 'text-red-400';
    }
    return 'text-gray-400';
  }, [data]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading token price"
        className={`inline-flex items-center gap-2 ${className}`.trim()}
      >
        <span className="h-2 w-14 rounded-full bg-white/10 animate-pulse" />
        {mode === 'full' && <span className="h-2 w-20 rounded-full bg-white/10 animate-pulse" />}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`text-sm text-gray-400 ${className}`.trim()} role="status">
        Price unavailable
      </div>
    );
  }

  if (mode === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 ${className}`.trim()}>
        <span className="text-sm font-semibold text-white">{formatPrice(data.priceUsd)}</span>
        <span className={`text-xs font-medium ${changeClasses}`}>{formatChange(data.priceChange24h)}</span>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`.trim()}>
      <div className="rounded-xl border border-gray-700 bg-surface-100 p-4">
        <p className="text-xs text-gray-400">Price</p>
        <p className="text-xl font-bold text-white mt-1">{formatPrice(data.priceUsd)}</p>
      </div>
      <div className="rounded-xl border border-gray-700 bg-surface-100 p-4">
        <p className="text-xs text-gray-400">24h Change</p>
        <p className={`text-xl font-bold mt-1 ${changeClasses}`}>{formatChange(data.priceChange24h)}</p>
      </div>
      <div className="rounded-xl border border-gray-700 bg-surface-100 p-4">
        <p className="text-xs text-gray-400">Market Cap</p>
        <p className="text-xl font-bold text-white mt-1">{formatCompactUsd(data.marketCap)}</p>
      </div>
      <div className="rounded-xl border border-gray-700 bg-surface-100 p-4">
        <p className="text-xs text-gray-400">24h Volume</p>
        <p className="text-xl font-bold text-white mt-1">{formatCompactUsd(data.volume24h)}</p>
      </div>
    </div>
  );
}

export default TokenPrice;