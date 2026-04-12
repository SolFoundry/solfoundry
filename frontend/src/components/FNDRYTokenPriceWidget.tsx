'use client';

import React, { useState, useEffect, useRef } from 'react';

interface TokenPrice {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  priceHistory: number[];
  symbol: string;
  lastUpdated: string;
}

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  positive: boolean;
}

const Sparkline: React.FC<SparklineProps> = ({ data, width = 120, height = 40, positive }) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const color = positive ? '#22c55e' : '#ef4444';
  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
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
};

const SIZE_PRESETS = {
  sm: { wrapper: 'w-48', sparkWidth: 80, sparkHeight: 28, textSize: 'text-sm' },
  md: { wrapper: 'w-64', sparkWidth: 120, sparkHeight: 40, textSize: 'text-base' },
  lg: { wrapper: 'w-80', sparkWidth: 160, sparkHeight: 52, textSize: 'text-lg' },
};

interface FNDRYTokenPriceWidgetProps {
  tokenAddress?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Poll interval in ms (default 30000, min 15000) */
  refreshInterval?: number;
}

export const FNDRYTokenPriceWidget: React.FC<FNDRYTokenPriceWidgetProps> = ({
  tokenAddress = '0x',
  size = 'md',
  className = '',
  refreshInterval = 30000,
}) => {
  const [priceData, setPriceData] = useState<TokenPrice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastErrorTime, setLastErrorTime] = useState<number>(0);
  const historyRef = useRef<number[]>([]);
  const intervalMs = Math.max(refreshInterval, 15000);

  const preset = SIZE_PRESETS[size];
  const effectiveAddress = tokenAddress === '0x' ? '' : tokenAddress;

  const fetchPrice = async () => {
    try {
      // Try DexScreener new pairs API
      let priceUsd = 0;
      let priceChange = 0;
      let volume24h = 0;
      let liquidity = 0;

      // Search for FNDRY pair
      const searchRes = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${effectiveAddress ? effectiveAddress : 'FNDRY'}`
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const pairs: any[] = searchData.pairs || [];

        // Find the best FNDRY pair (by liquidity)
        const fndryPairs = pairs
          .filter((p: any) => {
            const sym = (p.baseToken?.symbol || '').toUpperCase();
            const addr = (p.baseToken?.address || '').toLowerCase();
            return sym.includes('FNDRY') || addr === effectiveAddress.toLowerCase();
          })
          .sort((a: any, b: any) => (b.liquidity || 0) - (a.liquidity || 0));

        if (fndryPairs.length > 0) {
          const pair = fndryPairs[0];
          priceUsd = parseFloat(pair.priceUsd || '0');
          priceChange = parseFloat(pair.priceChange?.h24 || '0');
          volume24h = parseFloat(pair.volume?.h24 || '0');
          liquidity = parseFloat(pair.liquidity || '0');
        }
      }

      // Fallback: if no data, simulate realistic FNDRY price
      if (priceUsd === 0) {
        // FNDRY hasn't launched yet or no pair found
        setError('Price data unavailable — FNDRY may not be listed yet');
        setLoading(false);
        return;
      }

      // Build rolling history (keep last 24 data points)
      const newHistory = [...historyRef.current, priceUsd].slice(-24);
      historyRef.current = newHistory;

      setPriceData({
        price: priceUsd,
        priceChange24h: priceChange,
        volume24h,
        liquidity,
        priceHistory: newHistory,
        symbol: 'FNDRY',
        lastUpdated: new Date().toISOString(),
      });
      setError(null);
    } catch (err) {
      // Don't spam updates on repeated errors
      const now = Date.now();
      if (now - lastErrorTime > 60000) {
        setError('Failed to fetch price data');
        setLastErrorTime(now);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, intervalMs);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAddress, intervalMs]);

  const formatPrice = (price: number) => {
    if (price < 0.0001) return `$${price.toExponential(2)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatLiquidity = (liq: number) => {
    if (liq >= 1_000_000) return `$${(liq / 1_000_000).toFixed(1)}M`;
    if (liq >= 1_000) return `$${(liq / 1_000).toFixed(1)}K`;
    return `$${liq.toFixed(0)}`;
  };

  const isPositive = (priceData?.priceChange24h ?? 0) >= 0;
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
  const changeBg = isPositive ? 'bg-green-500/10' : 'bg-red-500/10';
  const changeIcon = isPositive ? '▲' : '▼';

  return (
    <div
      className={`${preset.wrapper} bg-gray-900 rounded-xl border border-gray-700/50 p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-xs font-bold text-yellow-400">F</span>
          </div>
          <span className={`font-semibold ${preset.textSize} text-white`}>FNDRY</span>
        </div>
        <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${changeBg} ${changeColor}`}>
          {changeIcon} {Math.abs(priceData?.priceChange24h ?? 0).toFixed(1)}%
        </div>
      </div>

      {loading && !priceData ? (
        <div className="flex items-center justify-center h-20">
          <div className="w-5 h-5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
        </div>
      ) : error && !priceData ? (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400">{error}</p>
          <p className="text-xs text-gray-500 mt-1">Check DexScreener for listings</p>
        </div>
      ) : priceData ? (
        <>
          {/* Price + Sparkline */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className={`font-bold text-white ${size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl'}`}>
                {formatPrice(priceData.price)}
              </div>
              <div className={`text-xs ${changeColor} mt-0.5`}>
                {changeIcon} {Math.abs(priceData.priceChange24h).toFixed(2)}% (24h)
              </div>
            </div>
            <Sparkline
              data={priceData.priceHistory}
              width={preset.sparkWidth}
              height={preset.sparkHeight}
              positive={isPositive}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-700/40">
            <div>
              <div className="text-xs text-gray-500">24h Volume</div>
              <div className={`text-sm font-medium text-gray-300 ${preset.textSize}`}>
                {formatVolume(priceData.volume24h)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Liquidity</div>
              <div className={`text-sm font-medium text-gray-300 ${preset.textSize}`}>
                {formatLiquidity(priceData.liquidity)}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2 pt-2 border-t border-gray-700/30 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              via DexScreener
            </span>
            <span className="text-xs text-gray-600">
              {new Date(priceData.lastUpdated).toLocaleTimeString()}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default FNDRYTokenPriceWidget;
