import React from 'react';

interface StatusCounts {
  success?: number;
  failure?: number;
  running?: number;
  [key: string]: number | undefined;
}

interface Stats {
  total_runs: number;
  status_counts: StatusCounts;
  average_duration_seconds: number;
  success_rate: number;
}

interface Props {
  stats: Stats | null;
  isLoading: boolean;
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse bg-white/5 rounded-xl h-24" />
      ))}
    </div>
  );
}

function fmtDuration(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

export function PipelineStats({ stats, isLoading }: Props) {
  if (isLoading || !stats) return <Skeleton />;

  const pct = (stats.success_rate * 100).toFixed(1);
  const isHigh = stats.success_rate >= 0.7;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total runs */}
      <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-4">
        <p className="text-2xl font-bold text-white">{stats.total_runs}</p>
        <p className="text-xs text-white/50 mt-1">Total Runs</p>
      </div>

      {/* Success rate */}
      <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-4">
        <p className={`text-2xl font-bold ${isHigh ? 'text-[#14F195]' : 'text-red-400'}`}>
          {pct}%
        </p>
        <p className="text-xs text-white/50 mt-1">Success Rate</p>
      </div>

      {/* Pass / fail */}
      <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-4">
        <p className="text-sm text-[#14F195]">{stats.status_counts.success ?? 0} passed</p>
        <p className="text-sm text-red-400 mt-1">{stats.status_counts.failure ?? 0} failed</p>
        <p className="text-xs text-white/50 mt-1">Results</p>
      </div>

      {/* Avg duration */}
      <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-4">
        <p className="text-2xl font-bold text-white">
          {fmtDuration(stats.average_duration_seconds)}
        </p>
        <p className="text-xs text-white/50 mt-1">Avg Duration</p>
      </div>
    </div>
  );
}
