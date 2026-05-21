import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';

const FNDRY_TOKEN_ADDRESS = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${FNDRY_TOKEN_ADDRESS}`;

interface DexScreenerPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  priceChange?: { h24?: number };
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[] | null;
}

interface PriceSnapshot {
  price: number;
  timestamp: number;
}

function pickPrimaryPair(pairs: DexScreenerPair[] = []): DexScreenerPair | null {
  return pairs
    .filter((pair) => pair.chainId === 'solana' && typeof pair.priceUsd === 'string')
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
}

function formatUsd(value: number): string {
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(4)}`;
}

function Sparkline({ points, positive }: { points: PriceSnapshot[]; positive: boolean }) {
  const path = useMemo(() => {
    if (points.length < 2) return '';

    const width = 120;
    const height = 36;
    const prices = points.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - ((point.price - min) / range) * height;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [points]);

  if (!path) {
    return <div className="h-9 w-[120px] rounded bg-forge-800/60" aria-hidden="true" />;
  }

  return (
    <svg className="h-9 w-[120px]" viewBox="0 0 120 36" role="img" aria-label="FNDRY price sparkline">
      <path
        d={path}
        fill="none"
        stroke={positive ? 'rgb(52 211 153)' : 'rgb(244 114 182)'}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function FndryPriceWidget() {
  const [pair, setPair] = useState<DexScreenerPair | null>(null);
  const [history, setHistory] = useState<PriceSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPrice() {
      try {
        const response = await fetch(DEXSCREENER_URL);
        if (!response.ok) throw new Error(`DexScreener returned ${response.status}`);

        const data = (await response.json()) as DexScreenerResponse;
        const nextPair = pickPrimaryPair(data.pairs ?? []);
        if (!nextPair?.priceUsd) throw new Error('FNDRY pair not found');

        const price = Number(nextPair.priceUsd);
        if (!Number.isFinite(price)) throw new Error('Invalid FNDRY price');

        if (!isMounted) return;
        setPair(nextPair);
        setHistory((previous) => [...previous, { price, timestamp: Date.now() }].slice(-24));
        setError(null);
      } catch (caught) {
        if (!isMounted) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load FNDRY price');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPrice();
    const interval = window.setInterval(loadPrice, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const price = pair?.priceUsd ? Number(pair.priceUsd) : null;
  const change = pair?.priceChange?.h24 ?? 0;
  const isPositive = change >= 0;

  return (
    <section className="rounded-xl border border-border bg-forge-900 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-text-muted">FNDRY Price</p>
          <div className="mt-2 flex items-center gap-3">
            {isLoading && price == null ? (
              <Loader2 className="h-5 w-5 animate-spin text-emerald" />
            ) : price == null ? (
              <p className="font-mono text-sm text-status-warning">Unavailable</p>
            ) : (
              <p className="font-mono text-2xl font-bold text-text-primary">{formatUsd(price)}</p>
            )}
            {price != null && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-xs ${isPositive ? 'bg-emerald-bg text-emerald' : 'bg-magenta/10 text-magenta'}`}>
                {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change).toFixed(2)}% 24h
              </span>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-status-warning">{error}</p>}
        </div>
        <Sparkline points={history} positive={isPositive} />
      </div>
      {pair && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs sm:grid-cols-3">
          <div>
            <p className="text-text-muted">DEX</p>
            <p className="font-mono text-text-primary">{pair.dexId ?? 'Unknown'}</p>
          </div>
          <div>
            <p className="text-text-muted">Liquidity</p>
            <p className="font-mono text-text-primary">${Math.round(pair.liquidity?.usd ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-text-muted">24h Volume</p>
            <p className="font-mono text-text-primary">${Math.round(pair.volume?.h24 ?? 0).toLocaleString()}</p>
          </div>
        </div>
      )}
    </section>
  );
}
