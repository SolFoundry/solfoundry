/**
 * FNDRY Token Price Widget
 *
 * An embeddable React component that displays real-time FNDRY token price
 * from DexScreener API, including a sparkline chart, 24h price change,
 * and key market data. Responsive and works in multiple container sizes.
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Droplets,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Area,
  AreaChart,
  YAxis,
  Tooltip,
} from 'recharts';
import { useFndryPrice } from '../../hooks/useFndryPrice';

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/* ------------------------------------------------------------------ */
/*  Custom tooltip for sparkline chart                                 */
/* ------------------------------------------------------------------ */

function SparklineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-emerald-border bg-forge-800/90 px-2.5 py-1.5 text-xs font-mono text-text-primary shadow-xl backdrop-blur-sm">
      ${payload[0].value.toFixed(6)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-forge-700" />
        <div className="h-4 w-16 rounded bg-forge-700" />
      </div>
      <div className="mt-4 h-8 w-32 rounded bg-forge-700" />
      <div className="mt-2 h-3 w-20 rounded bg-forge-700" />
      <div className="mt-4 h-12 rounded bg-forge-700" />
      <div className="mt-3 flex gap-4">
        <div className="h-3 w-16 rounded bg-forge-700" />
        <div className="h-3 w-16 rounded bg-forge-700" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Error state                                                        */
/* ------------------------------------------------------------------ */

function WidgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-status-error/20 bg-forge-900 p-5 text-center">
      <Activity className="mx-auto h-8 w-8 text-status-error/60" />
      <p className="mt-2 text-sm text-text-muted">Price data unavailable</p>
      <button
        onClick={onRetry}
        className="mt-2 text-xs text-emerald hover:text-emerald-light transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main widget                                                        */
/* ------------------------------------------------------------------ */

interface FndryTokenPriceProps {
  /** Optional className for container styling */
  className?: string;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export function FndryTokenPrice({
  className = '',
  compact = false,
}: FndryTokenPriceProps) {
  const { data, isLoading, isError, refetch } = useFndryPrice();

  if (isLoading) return <WidgetSkeleton />;
  if (isError || !data) return <WidgetError onRetry={() => refetch()} />;

  const isPositive = data.change24h >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? 'text-emerald' : 'text-status-error';
  const trendBg = isPositive
    ? 'bg-emerald-bg border-emerald-border'
    : 'bg-status-error/10 border-status-error/20';

  // Prepare sparkline data for Recharts
  const sparklineData = data.sparkline.map((price, i) => ({
    label: `${i}h`,
    price,
  }));

  const sparkColor = isPositive ? '#00E676' : '#FF5252';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-xl border border-border bg-forge-900/90 backdrop-blur-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald/10">
            <DollarSign className="h-3.5 w-3.5 text-emerald" />
          </div>
          <span className="font-display text-sm font-semibold text-text-primary tracking-wide">
            $FNDRY
          </span>
        </div>

        {/* 24h change badge */}
        <div
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${trendBg} ${trendColor}`}
        >
          <TrendIcon className="h-3 w-3" />
          {isPositive ? '+' : ''}
          {data.change24h.toFixed(2)}%
        </div>
      </div>

      {/* Price */}
      <div className="px-5">
        <span className="font-mono text-2xl font-bold text-text-primary tracking-tight">
          {formatPrice(data.priceUsd)}
        </span>
        <span className="ml-2 text-xs text-text-muted">USD</span>
      </div>

      {/* Sparkline chart */}
      <div className="mt-2 h-14 px-5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData}>
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={sparkColor}
                  stopOpacity={0.25}
                />
                <stop
                  offset="100%"
                  stopColor={sparkColor}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <YAxis domain={['dataMin - 0.00001', 'dataMax + 0.00001']} hide />
            <Tooltip
              content={<SparklineTooltip />}
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={sparkColor}
              strokeWidth={1.5}
              fill="url(#sparkFill)"
              dot={false}
              activeDot={{
                r: 3,
                fill: sparkColor,
                stroke: '#050505',
                strokeWidth: 1.5,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Market stats row */}
      {!compact && (
        <div className="grid grid-cols-2 gap-px bg-border/30 px-5 py-3 mt-1">
          <div>
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
              <BarChart3 className="h-3 w-3" />
              Volume 24h
            </span>
            <span className="block font-mono text-xs font-medium text-text-primary mt-0.5">
              {formatCompact(data.volume24h)}
            </span>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
              <Droplets className="h-3 w-3" />
              Liquidity
            </span>
            <span className="block font-mono text-xs font-medium text-text-primary mt-0.5">
              {formatCompact(data.liquidityUsd)}
            </span>
          </div>
          <div className="col-span-2 mt-1.5 pt-1.5 border-t border-border/30">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
              <Activity className="h-3 w-3" />
              FDV (Fully Diluted Valuation)
            </span>
            <span className="block font-mono text-xs font-medium text-text-primary mt-0.5">
              {formatCompact(data.fdv)}
            </span>
          </div>
        </div>
      )}

      {/* Footer: last updated / source */}
      <div className="px-5 pb-3 pt-1">
        <p className="text-[10px] text-text-muted/50">
          Real-time via{' '}
          <a
            href={`https://dexscreener.com/${data.chainId}/${data.pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald/60 hover:text-emerald transition-colors"
          >
            DexScreener
          </a>
        </p>
      </div>
    </motion.div>
  );
}