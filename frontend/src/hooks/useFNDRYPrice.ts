import { useState, useEffect, useCallback } from 'react';

const MINT = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
const URL = 'https://api.dexscreener.com/v1/token/' + MINT;

export interface FNDRYData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
}

export function useFNDRYPrice() {
  const [data, setData] = useState<FNDRYData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const pairs: any[] = Array.isArray(json) ? json : (json?.data ?? []);
      const pair = pairs[0];
      if (!pair) { setError('No data'); return; }
      setData({
        price: parseFloat(pair.priceUsd ?? '0'),
        priceChange24h: parseFloat(pair.priceChange?.h24 ?? '0'),
        volume24h: parseFloat(pair.volume?.h24 ?? '0'),
        liquidity: parseFloat(pair.liquidity?.usd ?? '0'),
        marketCap: parseFloat(pair.marketCap ?? '0'),
      });
      setError(null);
    } catch(e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 60000); return () => clearInterval(t); }, [fetch_]);
  return { data, loading, error, refetch: fetch_ };
}
