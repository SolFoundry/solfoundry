import React, { useMemo } from 'react';

export interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showArea?: boolean;
  areaColor?: string;
}

export function SparklineChart({
  data,
  width = 120,
  height = 40,
  color = '#10b981',
  strokeWidth = 2,
  showArea = true,
  areaColor = 'rgba(16, 185, 129, 0.15)',
}: SparklineChartProps) {
  const { path, areaPath } = useMemo(() => {
    if (data.length < 2) return { path: '', areaPath: '' };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const padding = strokeWidth;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return { x, y };
    });

    // Build SVG path
    let pathD = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      pathD += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
    }

    // Build area path
    let areaD = pathD;
    areaD += ` L ${points[points.length - 1].x},${height}`;
    areaD += ` L ${points[0].x},${height}`;
    areaD += ' Z';

    return { path: pathD, areaPath: areaD };
  }, [data, width, height, strokeWidth]);

  if (!path) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#9ca3af" fontSize="10">
          No data
        </text>
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {showArea && <path d={areaPath} fill={areaColor} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
