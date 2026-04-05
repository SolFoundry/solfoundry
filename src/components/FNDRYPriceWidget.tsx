import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TokenPrice {
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
}

interface SparklinePoint {
  time: number;
  price: number;
}

export function FNDRYPriceWidget({ compact = false }: { compact?: boolean }) {
  const [price, setPrice] = useState<TokenPrice | null>(null);
  const [sparkline, setSparkline] = useState<SparklinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // DexScreener API for FNDRY token
        const res = await fetch(
          'https://api.dexscreener.com/latest/dex/tokens/FNDRY_TOKEN_ADDRESS'
        );
        const data = await res.json();

        if (data.pairs?.[0]) {
          const pair = data.pairs[0];
          setPrice({
            priceUsd: parseFloat(pair.priceUsd),
            priceChange24h: parseFloat(pair.priceChange.h24),
            volume24h: parseFloat(pair.volume.h24),
            marketCap: pair.fdv ? parseFloat(pair.fdv) : undefined,
          });

          // Generate sparkline from price history
          if (pair.priceHistory) {
            setSparkline(
              pair.priceHistory.map((p: { time: number; price: number }) => ({
                time: p.time,
                price: p.price,
              }))
            );
          }
        }
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`bg-forge-900 border border-forge-700 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-forge-700" />
          <div className="flex-1">
            <div className="h-4 w-20 bg-forge-700 rounded mb-2" />
            <div className="h-6 w-32 bg-forge-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !price) {
    return (
      <div className={`bg-forge-900 border border-forge-700 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
        <div className="text-muted text-sm">Price unavailable</div>
      </div>
    );
  }

  const isPositive = price.priceChange24h >= 0;
  const changeColor = isPositive ? 'text-emerald' : 'text-error';
  const changeIcon = isPositive ? '鈫? : '鈫?;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-forge-900 border border-forge-700 rounded-lg hover:border-forge-600 transition-colors ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Token Icon */}
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald to-purple flex items-center justify-center">
            <span className="text-lg font-bold text-forge-950">F</span>
          </div>
        </div>

        {/* Price Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-primary">FNDRY</span>
            <span className="text-xs text-muted bg-forge-800 px-2 py-0.5 rounded">SOL</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-primary">
              ${price.priceUsd.toLocaleString(undefined, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 6,
              })}
            </span>

            <span className={`text-sm font-medium ${changeColor}`}>
              {changeIcon} {Math.abs(price.priceChange24h).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Sparkline Chart */}
      {!compact && sparkline.length > 0 && (
        <div className="mt-3 h-12">
          <Sparkline data={sparkline} positive={isPositive} />
        </div>
      )}

      {/* Additional Stats */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-forge-700 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted mb-1">24h Volume</div>
            <div className="text-sm font-medium text-primary">
              ${(price.volume24h / 1000).toFixed(1)}K
            </div>
          </div>
          {price.marketCap && (
            <div>
              <div className="text-xs text-muted mb-1">Market Cap</div>
              <div className="text-sm font-medium text-primary">
                ${(price.marketCap / 1000000).toFixed(2)}M
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Sparkline({ data, positive }: { data: SparklinePoint[]; positive: boolean }) {
  if (data.length < 2) return null;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const width = 200;
  const height = 48;
  const padding = 2;

  const points = data
    .map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.price - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  const gradientId = `sparkline-gradient-${positive ? 'up' : 'down'}`;
  const strokeColor = positive ? '#00E676' : '#FF5252';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <polygon
        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        fill={`url(#${gradientId})`}
      />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default FNDRYPriceWidget;