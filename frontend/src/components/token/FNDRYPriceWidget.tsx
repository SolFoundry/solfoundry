import React, { useState, useEffect } from 'react';
import { useFNDRYPrice, PriceData } from './useFNDRYPrice';
import { SparklineChart } from './SparklineChart';

export interface FNDRYPriceWidgetProps {
  /** Refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  /** Show volume data (default: true) */
  showVolume?: boolean;
  /** Show transaction data (default: false) */
  showTransactions?: boolean;
  /** Compact mode for smaller containers */
  compact?: boolean;
  /** Custom className for styling */
  className?: string;
  /** DexScreener pair address override */
  pairAddress?: string;
}

export function FNDRYPriceWidget({
  refreshInterval = 30000,
  showVolume = true,
  showTransactions = false,
  compact = false,
  className = '',
}: FNDRYPriceWidgetProps) {
  const { data, loading, error, refresh } = useFNDRYPrice(refreshInterval);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refresh();
    // Simulate refresh animation
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsRefreshing(false);
  };

  if (error && !data) {
    return (
      <div className={`fndry-widget fndry-widget--error ${className}`}>
        <div className="fndry-widget__error">
          <span className="fndry-widget__error-icon">⚠️</span>
          <span className="fndry-widget__error-text">Failed to load price data</span>
          <button className="fndry-widget__retry" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fndry-widget ${compact ? 'fndry-widget--compact' : ''} ${className}`}>
      {/* Header */}
      <div className="fndry-widget__header">
        <div className="fndry-widget__token">
          <span className="fndry-widget__token-icon">🪙</span>
          <span className="fndry-widget__token-name">FNDRY</span>
        </div>
        <div className="fndry-widget__actions">
          {data && (
            <span className="fndry-widget__updated">
              {formatTimeAgo(data.lastUpdated)}
            </span>
          )}
          <button
            className={`fndry-widget__refresh ${isRefreshing ? 'fndry-widget__refresh--spinning' : ''}`}
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh price"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Price Display */}
      <div className="fndry-widget__price">
        {loading && !data ? (
          <div className="fndry-widget__skeleton">
            <div className="fndry-widget__skeleton-price" />
            <div className="fndry-widget__skeleton-change" />
          </div>
        ) : (
          <>
            <span className="fndry-widget__price-value">
              ${formatPrice(data?.priceUsd || '0')}
            </span>
            <PriceChangeBadge change={data?.priceChange.h24 || 0} />
          </>
        )}
      </div>

      {/* Sparkline */}
      {!loading && data?.sparkline && (
        <div className="fndry-widget__chart">
          <SparklineChart
            data={data.sparkline}
            width={compact ? 100 : 200}
            height={compact ? 30 : 50}
            color={getChangeColor(data.priceChange.h24)}
          />
        </div>
      )}

      {/* Volume */}
      {showVolume && !loading && data && (
        <div className="fndry-widget__stats">
          <div className="fndry-widget__stat">
            <span className="fndry-widget__stat-label">24h Volume</span>
            <span className="fndry-widget__stat-value">
              ${formatCompactNumber(data.volume.h24)}
            </span>
          </div>
        </div>
      )}

      {/* Transactions */}
      {showTransactions && !loading && data && (
        <div className="fndry-widget__stats">
          <div className="fndry-widget__stat">
            <span className="fndry-widget__stat-label">Buys</span>
            <span className="fndry-widget__stat-value fndry-widget__stat-value--buy">
              {data.txns.h24.buys}
            </span>
          </div>
          <div className="fndry-widget__stat">
            <span className="fndry-widget__stat-label">Sells</span>
            <span className="fndry-widget__stat-value fndry-widget__stat-value--sell">
              {data.txns.h24.sells}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fndry-widget__footer">
        <span className="fndry-widget__source">
          Powered by DexScreener
        </span>
      </div>

      <style>{widgetStyles}</style>
    </div>
  );
}

/* ─── Sub-components ─── */

function PriceChangeBadge({ change }: { change: number }) {
  const isPositive = change >= 0;
  return (
    <span className={`fndry-widget__change ${isPositive ? 'fndry-widget__change--positive' : 'fndry-widget__change--negative'}`}>
      {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
    </span>
  );
}

/* ─── Helpers ─── */

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return '$0.00';
  if (num < 0.0001) return `$${num.toExponential(4)}`;
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function getChangeColor(change: number): string {
  return change >= 0 ? '#10b981' : '#ef4444';
}

/* ─── Styles ─── */

const widgetStyles = `
.fndry-widget {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 16px;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 320px;
  border: 1px solid #2d2d44;
  transition: all 0.2s ease;
}

.fndry-widget:hover {
  border-color: #4a4a6a;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.fndry-widget--compact {
  padding: 10px;
  max-width: 240px;
}

.fndry-widget__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.fndry-widget__token {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fndry-widget__token-icon {
  font-size: 18px;
}

.fndry-widget__token-name {
  font-weight: 600;
  font-size: 14px;
  color: #fbbf24;
}

.fndry-widget__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fndry-widget__updated {
  font-size: 11px;
  color: #6b7280;
}

.fndry-widget__refresh {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.fndry-widget__refresh:hover {
  opacity: 1;
}

.fndry-widget__refresh--spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.fndry-widget__price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.fndry-widget__price-value {
  font-size: 24px;
  font-weight: 700;
  color: #f8fafc;
}

.fndry-widget--compact .fndry-widget__price-value {
  font-size: 18px;
}

.fndry-widget__change {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}

.fndry-widget__change--positive {
  color: #10b981;
  background: rgba(16, 185, 129, 0.15);
}

.fndry-widget__change--negative {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.fndry-widget__chart {
  margin: 8px 0;
}

.fndry-widget__stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2d2d44;
}

.fndry-widget__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fndry-widget__stat-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fndry-widget__stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}

.fndry-widget__stat-value--buy {
  color: #10b981;
}

.fndry-widget__stat-value--sell {
  color: #ef4444;
}

.fndry-widget__footer {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2d2d44;
}

.fndry-widget__source {
  font-size: 10px;
  color: #4b5563;
}

.fndry-widget__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
}

.fndry-widget__error-text {
  font-size: 13px;
  color: #ef4444;
}

.fndry-widget__retry {
  margin-left: auto;
  background: #ef4444;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.fndry-widget__skeleton {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fndry-widget__skeleton-price {
  width: 100px;
  height: 24px;
  background: linear-gradient(90deg, #2d2d44 25%, #3d3d54 50%, #2d2d44 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.fndry-widget__skeleton-change {
  width: 60px;
  height: 20px;
  background: linear-gradient(90deg, #2d2d44 25%, #3d3d54 50%, #2d2d44 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Responsive */
@media (max-width: 480px) {
  .fndry-widget {
    max-width: 100%;
  }
}
`;
