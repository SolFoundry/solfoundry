import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useFNDRYPrice } from '../../hooks/useFNDRYPrice';

interface TokenPriceWidgetProps {
  /** Compact mode for small containers (e.g. navbar) */
  compact?: boolean;
  /** Override the auto-refresh interval (ms). Defaults to 60s. */
  refreshIntervalMs?: number;
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const color = positive ? '#00E676' : '#FF5252';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/** Internal state to accumulate sparkline history */
function useSparklineData(price: number | null, intervalMs: number) {
  const historyRef = useRef<number[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (price !== null) {
      historyRef.current = [...historyRef.current, price].slice(-20);
    }
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      if (price !== null) {
        historyRef.current = [...historyRef.current, price].slice(-20);
      }
    }, intervalMs);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return historyRef.current;
}

export function TokenPriceWidget({ compact = false, refreshIntervalMs = 60_000 }: TokenPriceWidgetProps) {
  const { data, loading, error, refetch } = useFNDRYPrice();
  const positive = (data?.priceChange24h ?? 0) >= 0;
  const history = useSparklineData(data?.price ?? null, refreshIntervalMs);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-forge-900 border border-border">
        {loading ? (
          <RefreshCw className="w-3.5 h-3.5 text-text-muted animate-spin" />
        ) : error ? (
          <span className="text-xs text-status-error">--</span>
        ) : (
          <>
            <span className="font-mono text-sm font-semibold text-text-primary">
              {data ? formatPrice(data.price) : '--'}
            </span>
            {data && (
              <span className={`text-xs font-medium ${positive ? 'text-emerald' : 'text-status-error'}`}>
                {positive ? '+' : ''}{data.priceChange24h.toFixed(2)}%
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-xl border border-border bg-forge-900 p-5 overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-card-glow pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald to-purple flex items-center justify-center">
            <span className="text-xs font-bold text-text-inverse font-display">F</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary font-display">FNDRY</p>
            <p className="text-xs text-text-muted">SolFoundry Token</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg border border-border hover:border-border-hover transition-colors"
          title="Refresh price"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Price + sparkline */}
      {loading && !data ? (
        <div className="flex items-center justify-center h-16">
          <RefreshCw className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      ) : error && !data ? (
        <div className="flex items-center justify-center h-16">
          <span className="text-sm text-status-error">Failed to load price</span>
        </div>
      ) : data ? (
        <>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="font-mono text-2xl font-bold text-text-primary">
                {formatPrice(data.price)}
              </p>
              <p className={`inline-flex items-center gap-1 text-sm font-medium mt-1 ${positive ? 'text-emerald' : 'text-status-error'}`}>
                {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {positive ? '+' : ''}{data.priceChange24h.toFixed(2)}% (24h)
              </p>
            </div>
            <Sparkline data={history.length >= 2 ? history : [data.price, data.price]} positive={positive} />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50">
            <div>
              <p className="text-xs text-text-muted">Market Cap</p>
              <p className="text-sm font-mono font-semibold text-text-primary">
                {formatLargeNumber(data.marketCap)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">24h Volume</p>
              <p className="text-sm font-mono font-semibold text-text-primary">
                {formatLargeNumber(data.volume24h)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Liquidity</p>
              <p className="text-sm font-mono font-semibold text-text-primary">
                {formatLargeNumber(data.liquidity)}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
