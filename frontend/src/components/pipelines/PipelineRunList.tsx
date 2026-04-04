import React, { useState } from 'react';

interface PipelineStage {
  id: string;
  name: string;
  stage_order: number;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  log_output: string | null;
  error_detail: string | null;
}

interface PipelineRun {
  id: string;
  repository: string;
  branch: string;
  commit_sha: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
  stages: PipelineStage[];
}

interface Props {
  runs: PipelineRun[];
  isLoading: boolean;
  total: number;
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-[#14F195]/20 text-[#14F195]',
  failure: 'bg-red-500/20 text-red-400',
  running: 'bg-blue-500/20 text-blue-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  passed: 'bg-[#14F195]/20 text-[#14F195]',
  failed: 'bg-red-500/20 text-red-400',
  skipped: 'bg-white/10 text-white/40',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[status] ?? 'bg-white/10 text-white/50'}`}>
      {status}
    </span>
  );
}

function fmtSha(sha: string) {
  return sha.slice(0, 7);
}

function RunRow({ run }: { run: PipelineRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden mb-3">
      <button
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} />
          <span className="text-sm font-mono text-white/80">{run.branch}</span>
          <span className="text-xs text-white/30 font-mono">{fmtSha(run.commit_sha)}</span>
          <span className="text-xs text-white/40 capitalize">{run.trigger}</span>
        </div>
        <span className="text-white/30 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5">
          {run.error_message && (
            <p className="text-xs text-red-400 mb-3 mt-2">{run.error_message}</p>
          )}
          <div className="space-y-1 mt-2">
            {run.stages
              .slice()
              .sort((a, b) => a.stage_order - b.stage_order)
              .map((stage) => (
                <div key={stage.id} className="flex items-center gap-3">
                  <StatusBadge status={stage.status} />
                  <span className="text-xs text-white/70">{stage.name}</span>
                  {stage.duration_seconds != null && (
                    <span className="text-xs text-white/30">{stage.duration_seconds}s</span>
                  )}
                  {stage.error_detail && (
                    <span className="text-xs text-red-400 truncate">{stage.error_detail}</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PipelineRunList({ runs, isLoading, total }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white/5 rounded-xl h-14" />
        ))}
      </div>
    );
  }

  if (!runs.length) {
    return (
      <p className="text-sm text-white/40 text-center py-8">No pipeline runs found.</p>
    );
  }

  return (
    <div>
      <p className="text-xs text-white/40 mb-3">{total} total runs</p>
      {runs.map((run) => (
        <RunRow key={run.id} run={run} />
      ))}
    </div>
  );
}
