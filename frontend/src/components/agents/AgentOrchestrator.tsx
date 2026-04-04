/**
 * AgentOrchestrator — autonomous multi-agent pipeline dashboard.
 *
 * Visualises the five pipeline stages (Bounty Scout → Requirement Analysis →
 * Implementation → Testing → PR Submission) with per-stage LLM assignments,
 * live status, and run controls.
 */
import React from 'react';
import { useAgentOrchestration } from '../../hooks/useAgentOrchestration';
import type { PipelineStage } from '../../hooks/useAgentOrchestration';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<string, string> = {
  idle:      'bg-white/20',
  running:   'bg-blue-400 animate-pulse',
  completed: 'bg-[#14F195]',
  failed:    'bg-red-400',
  skipped:   'bg-white/10',
};

const STATUS_TEXT: Record<string, string> = {
  idle:      'text-white/30',
  running:   'text-blue-400',
  completed: 'text-[#14F195]',
  failed:    'text-red-400',
  skipped:   'text-white/20',
};

const MODEL_BADGE: Record<string, string> = {
  'claude-opus-4-6':   'bg-purple-500/20 text-purple-300',
  'claude-sonnet-4-6': 'bg-blue-500/20 text-blue-300',
  'claude-haiku-4-5':  'bg-green-500/20 text-green-300',
};

// ---------------------------------------------------------------------------
// StageCard
// ---------------------------------------------------------------------------

function StageCard({ stage, index }: { stage: PipelineStage; index: number }) {
  return (
    <div
      className={`relative bg-[#0d0d1a] border rounded-xl p-4 transition-colors ${
        stage.status === 'running'
          ? 'border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
          : stage.status === 'completed'
          ? 'border-[#14F195]/20'
          : stage.status === 'failed'
          ? 'border-red-500/30'
          : 'border-white/10'
      }`}
    >
      {/* Step number */}
      <span className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center font-bold">
        {index + 1}
      </span>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-white">{stage.label}</p>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_TEXT[stage.status]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[stage.status]}`} />
          <span data-testid={`stage-status-${stage.id}`}>{stage.status}</span>
        </span>
      </div>

      {/* Model badge */}
      <span
        className={`inline-block text-xs px-2 py-0.5 rounded-full font-mono mb-3 ${
          MODEL_BADGE[stage.model] ?? 'bg-white/10 text-white/50'
        }`}
      >
        {stage.model}
      </span>

      {/* Output */}
      {stage.output && (
        <p className="text-xs text-white/60 leading-relaxed line-clamp-3 bg-white/5 rounded-lg p-2">
          {stage.output}
        </p>
      )}

      {/* Duration */}
      {stage.duration_ms != null && (
        <p className="text-xs text-white/30 mt-2">{(stage.duration_ms / 1000).toFixed(1)}s</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentOrchestrator
// ---------------------------------------------------------------------------

export function AgentOrchestrator() {
  const { run, startRun, stopRun, retryRun, isStarting } = useAgentOrchestration();

  const isIdle      = run.status === 'idle';
  const isRunning   = run.status === 'running';
  const isCompleted = run.status === 'completed';
  const isFailed    = run.status === 'failed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Autonomous Agent</h2>
          <p className="text-white/50 text-sm mt-1">
            finds bounties, analyzes requirements, implements solutions, runs tests, and submits PRs — without human intervention.
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-2 shrink-0">
          {(isIdle || isCompleted) && (
            <button
              onClick={startRun}
              disabled={isStarting}
              className="px-5 py-2.5 bg-[#14F195] text-black font-semibold rounded-xl text-sm disabled:opacity-40"
            >
              {isStarting ? 'Starting…' : 'Start Run'}
            </button>
          )}
          {isRunning && (
            <button
              onClick={stopRun}
              className="px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 font-semibold rounded-xl text-sm hover:bg-red-500/30"
            >
              Stop
            </button>
          )}
          {isFailed && (
            <button
              onClick={retryRun}
              className="px-5 py-2.5 bg-white/10 text-white font-semibold rounded-xl text-sm hover:bg-white/15"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Run summary banner */}
      {(isCompleted || isFailed) && (
        <div
          data-testid="run-summary"
          className={`rounded-xl px-4 py-3 flex items-center justify-between ${
            isCompleted
              ? 'bg-[#14F195]/10 border border-[#14F195]/20'
              : 'bg-red-500/10 border border-red-500/20'
          }`}
        >
          <span className={`text-sm font-medium ${isCompleted ? 'text-[#14F195]' : 'text-red-400'}`}>
            {isCompleted ? 'Run completed successfully' : 'Run failed'}
          </span>

          {isCompleted && run.pr_url && (
            <a
              data-testid="pr-link"
              href={run.pr_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#14F195] underline hover:opacity-80"
            >
              View PR ↗
            </a>
          )}
        </div>
      )}

      {/* Error message */}
      {isFailed && run.error && (
        <div
          data-testid="run-error"
          className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
        >
          <p className="text-sm text-red-400">{run.error}</p>
        </div>
      )}

      {/* Pipeline stages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {run.stages.map((stage, i) => (
          <StageCard key={stage.id} stage={stage} index={i} />
        ))}
      </div>
    </div>
  );
}
