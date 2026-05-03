import { ArrowDownRight, ArrowUpRight, ExternalLink, Loader2 } from 'lucide-react';
import { useFndryPrice } from '../../hooks/useFndryPrice';

function formatUsd(value: number): string {
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value);
}

function formatCompact(value?: number): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const width = 140;
  const height = 42;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const spread = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point - min) / spread) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full max-w-[160px] overflow-visible" role="img" aria-label="FNDRY 24 hour price trend">
      <path d={path} fill="none" stroke={positive ? '#00E676' : '#FF5252'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FndryPriceWidget({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, error } = useFndryPrice();
  const positive = (data?.change24h ?? 0) >= 0;
  const ChangeIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="w-full rounded-xl border border-border bg-forge-900/90 p-4 shadow-lg shadow-black/30 backdrop-blur-sm sm:min-w-[280px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">$FNDRY live</p>
          {isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading price…</div>
          ) : error || !data ? (
            <p className="mt-3 text-sm text-status-error">Price unavailable</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-2xl font-bold text-text-primary">{formatUsd(data.priceUsd)}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${positive ? 'bg-emerald/10 text-emerald' : 'bg-status-error/10 text-status-error'}`}>
                  <ChangeIcon className="h-3.5 w-3.5" /> {Math.abs(data.change24h).toFixed(2)}% 24h
                </span>
              </div>
              {!compact && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-text-muted">
                  <span>Vol 24h <strong className="text-text-secondary">${formatCompact(data.volume24h)}</strong></span>
                  <span>Liquidity <strong className="text-text-secondary">${formatCompact(data.liquidityUsd)}</strong></span>
                </div>
              )}
            </>
          )}
        </div>
        {data && <Sparkline points={data.sparkline} positive={positive} />}
      </div>
      {data?.pairUrl && (
        <a href={data.pairUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald hover:text-emerald-light">
          DexScreener <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
