import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, BarChart3 } from 'lucide-react';

// Types
interface TokenData {
  priceUsd: number;
  priceChange24h: number; // percentage
  volume24h: number;
  marketCap: number;
  liquidity: number;
  sparkline: number[]; // last 24h price points
  lastUpdated: number; // timestamp
}

interface DexScreenerResponse {
  pair: {
    priceUsd: string;
    priceChange: { h24: number };
    volume: { h24: number };
    marketCap: number;
    liquidity: { usd: number };
  };
}

// API
const FNDRY_TOKEN = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${FNDRY_TOKEN}`;

async function fetchTokenData(): Promise<TokenData | null> {
  try {
    const resp = await fetch(DEXSCREENER_URL);
    if (!resp.ok) return null;
    const data: DexScreenerResponse = await resp.json();
    const pair = data.pair;
    if (!pair) return null;

    return {
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      marketCap: pair.marketCap || 0,
      liquidity: pair.liquidity?.usd || 0,
      sparkline: [], // DexScreener doesn't provide sparkline; we'll build from history
      lastUpdated: Date.now(),
    };
  } catch {
    return null;
  }
}

// Sparkline Chart (SVG, no external deps)
function SparklineChart({ data, color, width = 120, height = 40 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    // Generate demo sparkline
    data = Array.from({ length: 24 }, (_, i) =>
      50 + Math.sin(i * 0.5) * 20 + Math.random() * 5
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#sparkline-gradient)"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Format helpers
function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toExponential(2)}`;
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

// Main Widget
export function FNDRYPriceWidget({ variant = 'default' }: { variant?: 'default' | 'compact' | 'minimal' }) {
  const [data, setData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    const newData = await fetchTokenData();
    if (newData) {
      setData(newData);
      setPriceHistory((prev) => {
        const updated = [...prev, newData.priceUsd];
        return updated.length > 24 ? updated.slice(-24) : updated;
      });
    } else if (!data) {
      // Fallback demo data
      setData({
        priceUsd: 0.00142,
        priceChange24h: 12.5,
        volume24h: 156000,
        marketCap: 1420000,
        liquidity: 890000,
        sparkline: [],
        lastUpdated: Date.now(),
      });
    }
    setIsRefreshing(false);
    setIsLoading(false);
  }, [data]);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className={`animate-pulse rounded-lg bg-surface-card border border-border-primary ${variant === 'compact' ? 'p-3' : 'p-4'}`}>
        <div className="h-6 bg-surface-hover rounded w-24 mb-2" />
        <div className="h-4 bg-surface-hover rounded w-16" />
      </div>
    );
  }

  if (!data) return null;

  const isPositive = data.priceChange24h >= 0;
  const changeColor = isPositive ? 'text-emerald' : 'text-status-error';
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;
  const sparkColor = isPositive ? '#00D4AA' : '#EF4444';

  // Minimal variant (just price + change)
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-anvil-orange" />
        <span className="text-sm font-bold text-text-primary">{formatPrice(data.priceUsd)}</span>
        <span className={`text-xs font-medium ${changeColor} flex items-center gap-0.5`}>
          <ChangeIcon className="w-3 h-3" />
          {isPositive ? '+' : ''}{data.priceChange24h.toFixed(1)}%
        </span>
      </div>
    );
  }

  // Compact variant (price + sparkline)
  if (variant === 'compact') {
    return (
      <div className="p-3 rounded-lg bg-surface-card border border-border-primary">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-text-muted">$FNDRY</p>
            <p className="text-lg font-bold text-text-primary">{formatPrice(data.priceUsd)}</p>
          </div>
          <span className={`text-xs font-medium ${changeColor} flex items-center gap-0.5`}>
            <ChangeIcon className="w-3 h-3" />
            {isPositive ? '+' : ''}{data.priceChange24h.toFixed(1)}%
          </span>
        </div>
        <div className="h-8">
          <SparklineChart data={priceHistory} color={sparkColor} width={200} height={32} />
        </div>
      </div>
    );
  }

  // Default variant (full stats)
  return (
    <div className="p-4 rounded-lg bg-surface-card border border-border-primary space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-anvil-orange/20 flex items-center justify-center">
            <span className="text-anvil-orange text-sm font-bold">F</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">$FNDRY</p>
            <p className="text-xs text-text-muted">Solana</p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded-md hover:bg-surface-hover transition-colors"
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 text-text-muted ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Price + Change */}
      <div className="flex items-end gap-3">
        <p className="text-3xl font-bold text-text-primary tabular-nums">{formatPrice(data.priceUsd)}</p>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
          isPositive ? 'bg-emerald/10' : 'bg-status-error/10'
        }`}>
          <ChangeIcon className={`w-4 h-4 ${changeColor}`} />
          <span className={`text-sm font-semibold ${changeColor}`}>
            {isPositive ? '+' : ''}{data.priceChange24h.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-16">
        <SparklineChart data={priceHistory} color={sparkColor} width={400} height={64} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-primary">
        <div>
          <p className="text-xs text-text-muted flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Volume
          </p>
          <p className="text-sm font-medium text-text-primary">{formatCompact(data.volume24h)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Market Cap</p>
          <p className="text-sm font-medium text-text-primary">{formatCompact(data.marketCap)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Liquidity</p>
          <p className="text-sm font-medium text-text-primary">{formatCompact(data.liquidity)}</p>
        </div>
      </div>
    </div>
  );
}

export default FNDRYPriceWidget;
