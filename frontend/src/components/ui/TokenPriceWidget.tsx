import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PriceData {
  price: number;
  change24h: number; // percentage
  volume24h: number;
  lastUpdated: string;
}

const POLL_INTERVAL = 60_000; // 60s

export function TokenPriceWidget() {
  const [data, setData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPrice = useCallback(async () => {
    try {
      const resp = await fetch("/api/token/price");
      if (resp.ok) {
        const json = await resp.json();
        setData(json);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  const changeIcon =
    !data ? null : data.change24h > 2 ? (
      <TrendingUp className="w-3.5 h-3.5 text-emerald" />
    ) : data.change24h < -2 ? (
      <TrendingDown className="w-3.5 h-3.5 text-status-error" />
    ) : (
      <Minus className="w-3.5 h-3.5 text-text-muted" />
    );

  const changeColor =
    !data ? "" : data.change24h > 0 ? "text-emerald" : data.change24h < 0 ? "text-status-error" : "text-text-muted";

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forge-800 border border-border">
        <div className="w-3 h-3 rounded-full bg-forge-700 animate-pulse" />
        <span className="text-xs text-text-muted font-mono">$FNDRY · ...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forge-800 border border-border">
        <span className="text-xs text-text-muted font-mono">$FNDRY · --</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forge-800 border border-border hover:border-border-hover transition-colors cursor-default">
      <span className="text-xs text-text-secondary font-mono">$FNDRY</span>
      <span className="text-sm font-semibold text-text-primary font-mono">
        ${data?.price?.toFixed(4) ?? "--"}
      </span>
      {changeIcon}
      <span className={`text-xs font-mono ${changeColor}`}>
        {data?.change24h != null
          ? `${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(1)}%`
          : "--"}
      </span>
    </div>
  );
}
