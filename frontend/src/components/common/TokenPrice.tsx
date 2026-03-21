/**
 * TokenPrice Component
 * 
 * Displays $FNDRY token price, market cap, and 24h change.
 * Fetches data from DexScreener API and auto-refreshes every 60 seconds.
 */
import { useState, useEffect, useCallback } from 'react';

// Token contract address
const FNDRY_CA = 'C2TvY8E8B75EF2UP8cTpTp3EDUjgjWmpaGnT74VBAGS';
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/tokens/${FNDRY_CA}`;
const REFRESH_INTERVAL = 60000; // 60 seconds

interface TokenData {
  priceUsd: string;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
}

interface TokenPriceProps {
  /** Compact mode for navbar: shows only price + change % */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format price in USD
 */
function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (num < 0.01) {
    return `$${num.toFixed(6)}`;
  }
  return `$${num.toFixed(4)}`;
}

/**
 * Format large numbers (market cap, volume)
 */
function formatCompact(num: number): string {
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }
  return `$${num.toFixed(2)}`;
}

/**
 * Fetch token data from DexScreener API
 */
async function fetchTokenData(): Promise<TokenData | null> {
  try {
    const response = await fetch(DEXSCREENER_API);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Get the first pair (most liquid)
    const pair = data.pairs?.[0];
    if (!pair) {
      throw new Error('No trading pair found');
    }
    
    return {
      priceUsd: pair.priceUsd || '0',
      priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
      marketCap: parseFloat(pair.fdv || '0'),
      volume24h: parseFloat(pair.volume?.h24 || '0'),
    };
  } catch (error) {
    console.error('Failed to fetch token data:', error);
    return null;
  }
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-4 w-16 bg-gray-300 dark:bg-gray-700 rounded" />
        <div className="h-4 w-12 bg-gray-300 dark:bg-gray-700 rounded" />
      </div>
    );
  }
  
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-6 w-24 bg-gray-300 dark:bg-gray-700 rounded" />
      <div className="h-4 w-16 bg-gray-300 dark:bg-gray-700 rounded" />
      <div className="h-4 w-20 bg-gray-300 dark:bg-gray-700 rounded" />
    </div>
  );
}

/**
 * TokenPrice Component
 */
export function TokenPrice({ compact = false, className = '' }: TokenPriceProps) {
  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const fetchData = useCallback(async () => {
    const result = await fetchTokenData();
    if (result) {
      setData(result);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);
  
  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, [fetchData]);
  
  if (loading) {
    return (
      <div className={className} aria-label="Loading token price">
        <LoadingSkeleton compact={compact} />
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className={`text-gray-500 text-sm ${className}`} aria-label="Price unavailable">
        Price unavailable
      </div>
    );
  }
  
  const isPositive = data.priceChange24h >= 0;
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500';
  const changeIcon = isPositive ? '▲' : '▼';
  
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`} aria-label="Token price">
        <span className="font-mono font-semibold text-gray-900 dark:text-white">
          {formatPrice(data.priceUsd)}
        </span>
        <span className={`text-sm font-medium ${changeColor}`}>
          {changeIcon} {Math.abs(data.priceChange24h).toFixed(2)}%
        </span>
      </div>
    );
  }
  
  return (
    <div className={`space-y-1 ${className}`} aria-label="Token price details">
      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
          {formatPrice(data.priceUsd)}
        </span>
        <span className={`text-sm font-medium ${changeColor}`}>
          {changeIcon} {Math.abs(data.priceChange24h).toFixed(2)}%
        </span>
      </div>
      
      {/* Market Cap & Volume */}
      <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>MCap: {formatCompact(data.marketCap)}</span>
        <span>24h Vol: {formatCompact(data.volume24h)}</span>
      </div>
    </div>
  );
}

export default TokenPrice;