import React, { useMemo } from 'react';

export interface EarningEntry {
  date: string;
  amount: number;
}

export interface EarningsChartProps {
  data: EarningEntry[];
  width?: number;
  height?: number;
}

export function EarningsChart({
  data,
  width = 400,
  height = 200,
}: EarningsChartProps) {
  const { bars, maxAmount } = useMemo(() => {
    if (data.length === 0) return { bars: [], maxAmount: 0 };

    const max = Math.max(...data.map((d) => d.amount));
    const barWidth = Math.max(4, Math.min(20, (width - 40) / data.length - 2));
    const chartHeight = height - 40;

    const bars = data
      .slice(-30)
      .reverse()
      .map((entry, index) => {
        const barHeight = max > 0 ? (entry.amount / max) * chartHeight : 0;
        return {
          x: 30 + index * (barWidth + 2),
          y: chartHeight - barHeight + 10,
          width: barWidth,
          height: Math.max(barHeight, 2),
          amount: entry.amount,
          date: entry.date,
        };
      });

    return { bars, maxAmount: max };
  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <div className="earnings-chart earnings-chart--empty">
        <span>No earnings data</span>
      </div>
    );
  }

  return (
    <div className="earnings-chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Y-axis labels */}
        <text x={5} y={15} fill="#6b7280" fontSize="10">
          {formatCompact(maxAmount)}
        </text>
        <text x={5} y={height - 10} fill="#6b7280" fontSize="10">
          0
        </text>

        {/* Bars */}
        {bars.map((bar, index) => (
          <g key={index}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={2}
              fill="url(#earnings-gradient)"
              className="earnings-chart__bar"
            >
              <title>
                {bar.date}: {formatCompact(bar.amount)} FNDRY
              </title>
            </rect>
          </g>
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="earnings-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toFixed(0);
}
