import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const TOKEN_MINT = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
const API_URL = 'https://api.dexscreener.com/v1/token/' + TOKEN_MINT;

interface SparklinePoint { price: string; timestamp: number; }

interface TokenInfo {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  sparkline: SparklinePoint[];
}

const EMPTY: TokenInfo = { price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, liquidity: 0, sparkline: [] };

function fmt(price: number): string {
  if (price >= 1) return '$' + price.toFixed(2);
  if (price >= 0.01) return '$' + price.toFixed(4);
  return '$' + price.toFixed(8);
}

function fmtNum(n: number): string {
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

export function FNDRYPriceWidget({ className = '' }: { className?: string }) {
  const [info, setInfo] = useState<TokenInfo>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const pairs: any[] = Array.isArray(json) ? json : (json?.data ?? []);
      const pair = pairs[0];
      if (!pair) { setErr('No trading data'); setLoading(false); return; }

      const price = parseFloat(pair.priceUsd ?? '0');
      const change = parseFloat(pair.priceChange?.h24 ?? '0');
      const vol = parseFloat(pair.volume?.h24 ?? '0');
      const liq = parseFloat(pair.liquidity?.usd ?? '0');
      const cap = parseFloat(pair.marketCap ?? '0');

      let sparkline: SparklinePoint[] = [];
      if (pair.txs?.h24?.length) {
        sparkline = pair.txs.h24.slice(-20).map((tx: any) => ({
          price: tx.priceUsd ?? '0',
          timestamp: tx.blockTimestamp ?? Date.now(),
        }));
      }

      setInfo({ price, priceChange24h: change, volume24h: vol, marketCap: cap, liquidity: liq, sparkline });
      setUpdated(new Date());
      setErr(null);
    } catch(e: any) {
      setErr(e.message ?? 'fetch failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  if (loading) return (
    <div className={\`bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-4 border border-purple-500/20 \${className}\`}>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-purple-500/20 rounded w-1/2" /><div className="h-8 bg-purple-500/20 rounded w-3/4" /><div className="h-3 bg-purple-500/20 rounded w-1/3" />
      </div>
    </div>
  );

  if (err) return (
    <div className={\`bg-gray-900/50 rounded-xl p-4 border border-gray-600/20 \${className}\`}>
      <p className="text-gray-400 text-sm">Price unavailable</p>
    </div>
  );

  const up = info.priceChange24h >= 0;
  const color = up ? 'text-green-400' : 'text-red-400';

  return (
    <div className={\`bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-4 border border-purple-500/20 \${className}\`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-xs font-bold">$</div>
          <span className="text-white font-semibold text-sm">FNDRY</span>
        </div>
        <span className="text-gray-500 text-xs">{updated ? updated.toLocaleTimeString() : ''}</span>
      </div>
      <div className="mb-2"><span className="text-white text-2xl font-bold">{fmt(info.price)}</span></div>
      <div className={\`flex items-center gap-1 mb-3 \${color}\`}>
        <span>{up ? '↑' : '↓'}</span>
        <span className="font-semibold">{Math.abs(info.priceChange24h).toFixed(2)}%</span>
        <span className="text-xs text-gray-400 ml-1">24h</span>
      </div>
      {info.sparkline.length > 1 && (
        <div className="h-12 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={info.sparkline}>
              <Line type="monotone" dataKey="price" stroke={up ? '#4ade80' : '#f87171'} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-gray-500">Market Cap</span><div className="text-gray-300 font-medium">{fmtNum(info.marketCap)}</div></div>
        <div><span className="text-gray-500">Liquidity</span><div className="text-gray-300 font-medium">{fmtNum(info.liquidity)}</div></div>
      </div>
    </div>
  );
}
