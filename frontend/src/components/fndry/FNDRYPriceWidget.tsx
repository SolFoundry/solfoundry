import React from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Loader2 } from 'lucide-react';
import { useFNDRYPrice } from '../../hooks/useFNDRYPrice';
import { SparklineChart } from '../ui/SparklineChart';

/* ─── Helpers ─── */

function formatUsd(price: number): string {
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  // Micro-cap prices
  return `$${price.toFixed(6)}`;
}

function formatCompact(num: number): string {
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

function formatPercent(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/* ─── Widget Variants ─── */

interface FNDRYPriceWidgetProps {
  /** FNDRY token address override (defaults to hardcoded address). */
  tokenAddress?: string;
  /** Widget size variant. */
  variant?: 'compact' | 'default' | 'full';
  /** Additional className for the wrapper. */
  className?: string;
}

export function FNDRYPriceWidget({
  tokenAddress,
  variant = 'default',
  className = '',
}: FNDRYPriceWidgetProps) {
  const { data, loading, error, refetch } = useFNDRYPrice(tokenAddress);

  if (error) {
    return (
      <div className={`rounded-xl border border-red-400/30 bg-forge-900 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <TrendingDown className="w-4 h-4" />
          <span>Price unavailable</span>
          <button onClick={refetch} className="ml-auto p-1 hover:text-red-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className={`rounded-xl border border-border bg-forge-900 p-4 animate-pulse ${className}`}>
        <div className="h-4 w-20 bg-forge-700 rounded mb-2" />
        <div className="h-8 w-28 bg-forge-700 rounded mb-3" />
        <div className="h-3 w-16 bg-forge-700 rounded" />
      </div>
    );
  }

  const isPositive = data.priceChange24h > 0;
  const isNeutral = data.priceChange24h === 0;
  const changeColor = isPositive ? 'text-emerald' : isNeutral ? 'text-text-muted' : 'text-red-400';
  const ChangeIcon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown;
  const sparkColor = isPositive ? '#00E676' : '#EF4444';

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-forge-900 ${className}`}>
        <span className="font-mono text-sm font-semibold text-text-primary">
          {formatUsd(data.priceUsd)}
        </span>
        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${changeColor}`}>
          <ChangeIcon className="w-3 h-3" />
          {formatPercent(data.priceChange24h)}
        </span>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`rounded-xl border border-border bg-forge-900 p-5 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-secondary">$FNDRY</span>
            <span className="text-[10px] font-mono text-text-muted uppercase bg-forge-800 px-1.5 py-0.5 rounded">
              Solana
            </span>
          </div>
          <button onClick={refetch} className="p-1 text-text-muted hover:text-text-secondary transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Price + Change */}
        <div className="flex items-end gap-3 mb-4">
          <span className="font-mono text-2xl font-bold text-text-primary">
            {formatUsd(data.priceUsd)}
          </span>
          <span className={`inline-flex items-center gap-1 text-sm font-medium mb-0.5 ${changeColor}`}>
            <ChangeIcon className="w-4 h-4" />
            {formatPercent(data.priceChange24h)}
          </span>
        </div>

        {/* Sparkline */}
        <div className="mb-4">
          <SparklineChart
            data={data.sparkline}
            width={280}
            height={60}
            strokeColor={sparkColor}
            strokeWidth={2}
          />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="px-2 py-2 rounded-lg bg-forge-800">
            <div className="text-[10px] uppercase text-text-muted mb-0.5">24h Volume</div>
            <div className="font-mono text-sm text-text-primary">{formatCompact(data.volume24h)}</div>
          </div>
          <div className="px-2 py-2 rounded-lg bg-forge-800">
            <div className="text-[10px] uppercase text-text-muted mb-0.5">Liquidity</div>
            <div className="font-mono text-sm text-text-primary">{formatCompact(data.liquidity)}</div>
          </div>
          <div className="px-2 py-2 rounded-lg bg-forge-800">
            <div className="text-[10px] uppercase text-text-muted mb-0.5">FDV</div>
            <div className="font-mono text-sm text-text-primary">{formatCompact(data.fdv)}</div>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`rounded-xl border border-border bg-forge-900 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-text-secondary">$FNDRY</span>
        <button onClick={refetch} className="p-1 text-text-muted hover:text-text-secondary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Price row */}
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-xl font-bold text-text-primary">
          {formatUsd(data.priceUsd)}
        </span>
        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${changeColor}`}>
          <ChangeIcon className="w-3.5 h-3.5" />
          {formatPercent(data.priceChange24h)}
        </span>
      </div>

      {/* Sparkline */}
      <SparklineChart
        data={data.sparkline}
        width={200}
        height={36}
        strokeColor={sparkColor}
      />
    </div>
  );
}
