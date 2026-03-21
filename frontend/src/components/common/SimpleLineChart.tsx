'use client';

import React, { useMemo } from 'react';

export interface DataPoint {
  label: string;
  value: number;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  height?: number;
  width?: string | number;
  color?: string;
  strokeWidth?: number;
  showPoints?: boolean;
  showGrid?: boolean;
  className?: string;
}

/**
 * Lightweight SVG line chart for dashboard metrics (Phase 1).
 * Avoids heavy charting d3-based libraries for fast initial load.
 */
export function SimpleLineChart({
  data,
  height = 160,
  width = '100%',
  color = '#14F195',
  strokeWidth = 3,
  showPoints = true,
  showGrid = true,
  className = ''
}: SimpleLineChartProps) {
  // SVG coordinates calculation
  const padding = 20;
  const chartHeight = height - padding * 2;
  const chartWidth = 400; // Reference internal width for coordinate mapping

  const { points, gridLines, maxValue } = useMemo(() => {
    if (!data.length) return { points: '', gridLines: [], maxValue: 0 };

    const maxVal = Math.max(...data.map(d => d.value), 10);
    const xStep = chartWidth / (data.length - 1 || 1);
    
    // Map values to Y coordinates (inverted for SVG)
    const pointsList = data.map((d, i) => {
      const x = i * xStep;
      const y = chartHeight - (d.value / maxVal) * chartHeight;
      return { x, y };
    });

    const path = pointsList.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    // Grid lines calculation
    const lines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = chartHeight - pct * chartHeight;
        return { y, label: (pct * maxVal).toFixed(0) };
    });

    return { points: path, gridLines: lines, maxValue: maxVal, pointCoords: pointsList };
  }, [data, chartHeight, chartWidth]);

  if (!data.length) return <div className="h-[160px] flex items-center justify-center text-gray-500 text-sm italic">No data to display.</div>;

  return (
    <div className={`relative w-full overflow-visible ${className}`} style={{ height }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
        style={{ padding: `${padding}px 0` }}
      >
        {/* Helper Grids */}
        {showGrid && gridLines.map((line, i) => (
          <line
            key={i}
            x1="0"
            y1={line.y}
            x2={chartWidth}
            y2={line.y}
            stroke="white"
            strokeOpacity="0.05"
            strokeDasharray="4 2"
          />
        ))}

        {/* Main Area Gradient */}
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Earning Line */}
        <path
          d={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-[0_0_8px_rgba(20,241,149,0.3)]"
        />

        {/* Gradient fill */}
        <path
           d={`${points} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
           fill="url(#chartGradient)"
           stroke="none"
        />

        {/* Interactive Points */}
        {showPoints && data.map((d, i) => {
          const x = i * (chartWidth / (data.length - 1 || 1));
          const y = chartHeight - (d.value / maxValue) * chartHeight;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill={color}
              className="hover:r-6 cursor-pointer transition-all"
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
        })}
      </svg>
      
      {/* X Axis Labels */}
      <div className="flex justify-between mt-2 px-1">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-gray-500 font-medium uppercase truncate w-12 text-center">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
