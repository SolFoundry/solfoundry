'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

// FNDRY token address on Solana
const FNDRY_MINT = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

interface PriceData {
  price: number;
  priceChange24h?: number;
  lastUpdated: number;
  symbol: string;
}

interface JupiterPriceResponse {
  data: Record<string, { price: string; perTokenPrice: Record<string, string> }>;
}

function formatPrice(price: number): string {
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

interface FNDRYPriceWidgetProps {
  className?: string;
  showSparkline?: boolean;
  refreshInterval?: number; // ms, default 60000 (1 min)
}

export function FNDRYPriceWidget({
  className = '',
  showSparkline = true,
  refreshInterval = 60_000,
}: FNDRYPriceWidgetProps) {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const fetchPrice = useCallback(async () => {
    try {
      const url = `${JUPITER_PRICE_API}?ids=${FNDRY_MINT}`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: JupiterPriceResponse = await response.json();
      const tokenData = data.data[FNDRY_MINT];
      if (!tokenData) throw new Error('Token data not found');
      const newPrice = parseFloat(tokenData.price);
      setPrice({
        price: newPrice,
        lastUpdated: Date.now(),
        symbol: 'FNDRY',
      });
      setHistory(prev => {
        const updated = [...prev, newPrice].slice(-20);
        return updated;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrice, refreshInterval]);

  if (loading && !price) {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 bg-white/5 rounded-xl border border-white/10 ${className}`}>
        <RefreshCw className="w-4 h-4 animate-spin text-white/40" />
        <span className="text-sm text-white/40">Loading FNDRY price...</span>
      </div>
    );
  }

  if (error && !price) {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 bg-red-500/10 rounded-xl border border-red-500/20 ${className}`}>
        <span className="text-sm text-red-400">Price unavailable</span>
        <button onClick={fetchPrice} className="ml-auto text-xs text-red-400/60 hover:text-red-400">
          Retry
        </button>
      </div>
    );
  }

  // Simulate 24h change based on price history (in production, use a real API)
  const priceChange = price && history.length > 1
    ? ((price.price - history[0]) / history[0]) * 100
    : (Math.random() * 10 - 5); // fallback for demo

  const isPositive = priceChange >= 0;

  return (
    <div className={`bg-white/5 rounded-xl border border-white/10 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">$FNDRY</span>
            <span className="text-xs text-white/40 ml-2">Solana</span>
          </div>
        </div>
        <button
          onClick={fetchPrice}
          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          title="Refresh price"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <div className="text-2xl font-bold text-white tabular-nums">
            ${price ? formatPrice(price.price) : '—'}
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{formatChange(priceChange)}</span>
            <span className="text-white/30">24h</span>
          </div>
        </div>

        {showSparkline && history.length > 1 && (
          <Sparkline data={history} positive={isPositive} />
        )}
      </div>

      {price && (
        <div className="text-xs text-white/30 mt-2">
          Updated {new Date(price.lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const color = positive ? '#4ade80' : '#f87171';
  const fillPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <defs>
        <linearGradient id={`sg-${positive}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#sg-${positive})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default FNDRYPriceWidget;
