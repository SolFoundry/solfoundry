import React from 'react';

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}

/**
 * Minimal SVG sparkline — no charting library needed.
 * Draws a polyline from the data points with an optional gradient fill.
 */
export function SparklineChart({
  data,
  width = 120,
  height = 40,
  strokeColor = '#00E676',
  fillColor,
  strokeWidth = 1.5,
}: SparklineChartProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-50">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2}
          stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="2,4" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // avoid div-by-zero
  const padY = 2; // px padding top/bottom

  // Map data to SVG coordinates
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padY + ((max - val) / range) * (height - padY * 2);
    return `${x},${y}`;
  });

  const polylinePoints = points.join(' ');
  const fillId = `sparkline-fill-${React.useId()}`;
  const gradientFill = fillColor ?? `url(#${fillId})`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <polygon
        points={`0,${height} ${polylinePoints} ${width},${height}`}
        fill={gradientFill}
      />

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current price dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={parseFloat(points[points.length - 1].split(',')[1])}
          r="2.5"
          fill={strokeColor}
        />
      )}
    </svg>
  );
}
