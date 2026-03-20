'use client';

import React from 'react';
import { PerformanceDataPoint } from '../../lib/agents';

interface PerformanceChartProps {
  data: PerformanceDataPoint[];
}

/**
 * Simple SVG-based performance chart (no external chart library dependency).
 * Shows success rate as a line chart and bounties completed as bars.
 */
export default function PerformanceChart({ data }: PerformanceChartProps) {
  if (data.length === 0) return <p className="text-sm text-gray-400">No performance data available.</p>;

  const chartWidth = 500;
  const chartHeight = 200;
  const padding = { top: 20, right: 40, bottom: 40, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxBounties = Math.max(...data.map((d) => d.bountiesCompleted), 1);
  const barWidth = innerWidth / data.length * 0.6;
  const barGap = innerWidth / data.length;

  // Scale success rate from 0-100 to chart height
  const scaleY = (rate: number) => padding.top + innerHeight - (rate / 100) * innerHeight;
  const scaleBarY = (count: number) => padding.top + innerHeight - (count / maxBounties) * innerHeight;

  // Build line path for success rate
  const linePoints = data.map((d, i) => {
    const x = padding.left + i * barGap + barGap / 2;
    const y = scaleY(d.successRate);
    return `${x},${y}`;
  });
  const linePath = `M ${linePoints.join(' L ')}`;

  return (
    <div className="w-full overflow-x-auto" data-testid="performance-chart">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto min-w-[400px]">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={scaleY(tick)}
              x2={chartWidth - padding.right}
              y2={scaleY(tick)}
              stroke="#e5e7eb"
              strokeDasharray="4,4"
            />
            <text
              x={padding.left - 8}
              y={scaleY(tick) + 4}
              textAnchor="end"
              className="text-[10px] fill-gray-400"
            >
              {tick}%
            </text>
          </g>
        ))}

        {/* Bars for bounties completed */}
        {data.map((d, i) => {
          const x = padding.left + i * barGap + (barGap - barWidth) / 2;
          const barHeight = (d.bountiesCompleted / maxBounties) * innerHeight;
          const y = padding.top + innerHeight - barHeight;
          return (
            <g key={`bar-${i}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill="#e0e7ff"
                opacity={0.7}
              />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                className="text-[9px] fill-indigo-400 font-medium"
              >
                {d.bountiesCompleted}
              </text>
            </g>
          );
        })}

        {/* Line for success rate */}
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots on line */}
        {data.map((d, i) => {
          const x = padding.left + i * barGap + barGap / 2;
          const y = scaleY(d.successRate);
          return (
            <circle key={`dot-${i}`} cx={x} cy={y} r={4} fill="#6366f1" stroke="white" strokeWidth={2} />
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = padding.left + i * barGap + barGap / 2;
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={chartHeight - 8}
              textAnchor="middle"
              className="text-[11px] fill-gray-500 font-medium"
            >
              {d.month}
            </text>
          );
        })}

        {/* Legend */}
        <circle cx={chartWidth - padding.right - 100} cy={12} r={4} fill="#6366f1" />
        <text x={chartWidth - padding.right - 92} y={16} className="text-[10px] fill-gray-500">Success Rate</text>
        <rect x={chartWidth - padding.right - 40} y={8} width={10} height={10} rx={2} fill="#e0e7ff" opacity={0.7} />
        <text x={chartWidth - padding.right - 26} y={16} className="text-[10px] fill-gray-500">Bounties</text>
      </svg>
    </div>
  );
}