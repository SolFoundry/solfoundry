/**
 * ReputationHistoryChart — SVG line chart showing reputation score over time.
 *
 * No external chart library required. Pure SVG with:
 *   - Smooth cubic-bezier line and gradient fill
 *   - Hover tooltip showing score and nearest event
 *   - Responsive via preserveAspectRatio
 *   - Loading skeleton
 *
 * @module components/reputation/ReputationHistoryChart
 */
import React, { useState, useRef, useCallback } from 'react';
import { Skeleton } from '../common/Skeleton';
import type { ReputationSnapshot, ReputationEvent } from '../../types/reputation';

// ── Chart dimensions (viewBox space) ─────────────────────────────────────────

const VB_W = 560;
const VB_H = 180;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };
const CHART_W = VB_W - PAD.left - PAD.right;
const CHART_H = VB_H - PAD.top - PAD.bottom;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert history snapshots to SVG coordinate pairs. */
function toPoints(
  history: ReputationSnapshot[],
  minScore: number,
  maxScore: number,
): Array<{ x: number; y: number; snapshot: ReputationSnapshot }> {
  if (history.length === 0) return [];
  const range = maxScore - minScore || 1;
  return history.map((s, i) => ({
    x: PAD.left + (i / Math.max(history.length - 1, 1)) * CHART_W,
    y: PAD.top + CHART_H - ((s.score - minScore) / range) * CHART_H,
    snapshot: s,
  }));
}

/**
 * Build a smooth SVG path through points using cubic bezier curves.
 * Each segment's control points are at the horizontal midpoint,
 * creating a flowing S-curve through consecutive data points.
 */
function buildLinePath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return pts.length === 1 ? `M ${pts[0].x},${pts[0].y}` : '';
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C ${cpx},${prev.y.toFixed(1)} ${cpx},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }
  return d;
}

/** Build the closed area path (same curve + baseline back). */
function buildAreaPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  const baseline = PAD.top + CHART_H;
  const line = buildLinePath(pts);
  return `${line} L ${pts[pts.length - 1].x.toFixed(1)},${baseline} L ${pts[0].x.toFixed(1)},${baseline} Z`;
}

/** Format ISO date to short label, e.g. "Mar 15". */
function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Tooltip state ─────────────────────────────────────────────────────────────

interface TooltipState {
  pointIndex: number;
  svgX: number; // fractional 0–1 (for CSS left)
  svgY: number; // fractional 0–1 (for CSS top)
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ReputationHistoryChartProps {
  history: ReputationSnapshot[];
  events?: ReputationEvent[];
  loading?: boolean;
  className?: string;
}

export function ReputationHistoryChart({
  history,
  events = [],
  loading = false,
  className = '',
}: ReputationHistoryChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Derived values
  const scores = history.map(h => h.score);
  const minScore = Math.max(0, Math.min(...scores) - 20);
  const maxScore = Math.max(...scores) + 20 || 100;
  const points = toPoints(history, minScore, maxScore);

  // Y-axis grid lines (4 steps)
  const ySteps = 4;
  const yGridLines = Array.from({ length: ySteps + 1 }, (_, i) => {
    const fraction = i / ySteps;
    return {
      y: PAD.top + CHART_H * (1 - fraction),
      label: Math.round(minScore + (maxScore - minScore) * fraction).toLocaleString(),
    };
  });

  // X-axis labels: show first, middle, last
  const xLabels: Array<{ x: number; label: string }> = [];
  if (history.length > 0) {
    const indices = [0, Math.floor(history.length / 2), history.length - 1];
    for (const idx of [...new Set(indices)]) {
      xLabels.push({ x: points[idx].x, label: fmtDate(history[idx].date) });
    }
  }

  // Find event matching a given date
  function eventForDate(date: string): ReputationEvent | undefined {
    return events.find(e => e.date === date);
  }

  // Mouse hover: find nearest point
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || points.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const scaleX = VB_W / rect.width;
      const svgX = relX * scaleX;

      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].x - svgX);
        if (dist < minDist) { minDist = dist; closestIdx = i; }
      }

      setTooltip({
        pointIndex: closestIdx,
        svgX: (points[closestIdx].x - PAD.left) / CHART_W,
        svgY: (points[closestIdx].y - PAD.top) / CHART_H,
      });
    },
    [points],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Build paths
  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-surface-50 p-5 ${className}`}
        aria-busy="true"
        aria-label="Loading reputation chart"
      >
        <Skeleton height="1rem" width="10rem" rounded="md" className="mb-4" />
        <Skeleton height="9rem" width="100%" rounded="lg" />
        <div className="flex justify-between mt-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height="0.75rem" width="3.5rem" rounded="sm" />
          ))}
        </div>
      </div>
    );
  }

  const hoveredPoint = tooltip !== null ? points[tooltip.pointIndex] : null;
  const hoveredSnapshot = hoveredPoint?.snapshot ?? null;
  const hoveredEvent = hoveredSnapshot ? eventForDate(hoveredSnapshot.date) : null;

  // Tooltip position: flip to left side if past midpoint
  const tooltipOnLeft = tooltip !== null && tooltip.svgX > 0.55;

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-surface-50 p-5 ${className}`}
      role="region"
      aria-label="Reputation history chart"
    >
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Score History
      </h3>

      {history.length < 2 ? (
        <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
          Not enough data yet
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto cursor-crosshair select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="rep-area-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9945FF" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#9945FF" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Y-axis grid lines */}
            {yGridLines.map((g, i) => (
              <g key={i}>
                <line
                  x1={PAD.left}
                  y1={g.y}
                  x2={VB_W - PAD.right}
                  y2={g.y}
                  stroke="white"
                  strokeOpacity="0.05"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 6}
                  y={g.y + 4}
                  textAnchor="end"
                  fontSize="9"
                  fill="rgba(156,163,175,0.7)"
                  fontFamily="monospace"
                >
                  {g.label}
                </text>
              </g>
            ))}

            {/* Area fill */}
            <path d={areaPath} fill="url(#rep-area-fill)" />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke="#9945FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data point dots — visible on all, highlighted on hover */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={tooltip?.pointIndex === i ? 5 : 3}
                fill={tooltip?.pointIndex === i ? '#14F195' : '#9945FF'}
                stroke={tooltip?.pointIndex === i ? '#14F195' : 'transparent'}
                strokeWidth="2"
                strokeOpacity="0.4"
                style={{ transition: 'r 0.1s, fill 0.1s' }}
              />
            ))}

            {/* Vertical hover line */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={PAD.top}
                x2={hoveredPoint.x}
                y2={PAD.top + CHART_H}
                stroke="white"
                strokeOpacity="0.15"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
            )}

            {/* X-axis labels */}
            {xLabels.map((xl, i) => (
              <text
                key={i}
                x={xl.x}
                y={VB_H - 4}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(156,163,175,0.6)"
                fontFamily="monospace"
              >
                {xl.label}
              </text>
            ))}
          </svg>

          {/* Floating tooltip */}
          {tooltip !== null && hoveredSnapshot && (
            <div
              className={`absolute pointer-events-none z-10
                bg-surface-100 border border-white/10 rounded-xl px-3 py-2
                text-xs shadow-xl whitespace-nowrap
                -translate-y-full -mt-2`}
              style={{
                left: tooltipOnLeft
                  ? `calc(${tooltip.svgX * 100}% - 8px)`
                  : `calc(${tooltip.svgX * 100}% + 8px)`,
                top: `${Math.max(0, tooltip.svgY) * 100}%`,
                transform: tooltipOnLeft
                  ? 'translateX(-100%) translateY(-100%)'
                  : 'translateY(-100%)',
              }}
              role="tooltip"
            >
              <div className="font-semibold text-solana-green tabular-nums mb-0.5">
                {hoveredSnapshot.score.toLocaleString()} REP
              </div>
              <div className="text-gray-400">{fmtDate(hoveredSnapshot.date)}</div>
              {hoveredEvent && (
                <div className="text-gray-300 mt-1 border-t border-white/10 pt-1">
                  <span className="text-solana-green font-mono">+{hoveredEvent.delta}</span>
                  {' '}· {hoveredEvent.reason}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReputationHistoryChart;
