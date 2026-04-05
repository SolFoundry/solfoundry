/**
 * useAgentOrchestration — manages the lifecycle of an autonomous multi-agent run.
 *
 * Exposes the current run state, controls (start / stop / retry), and polls the
 * backend for status updates while a run is active.
 */
import { useCallback, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types (exported for tests + components)
// ---------------------------------------------------------------------------

export type StageStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';
export type RunStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface PipelineStage {
  id: string;
  name: string;
  label: string;
  model: string;
  status: StageStatus;
  output: string | null;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface OrchestratorRun {
  id: string | null;
  status: RunStatus;
  stages: PipelineStage[];
  bounty_id: string | null;
  pr_url: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

// ---------------------------------------------------------------------------
// Default stage definitions (model assignments)
// ---------------------------------------------------------------------------

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 's1', name: 'bounty_scout',         label: 'Bounty Scout',         model: 'claude-opus-4-6',   status: 'idle', output: null, duration_ms: null, started_at: null, finished_at: null },
  { id: 's2', name: 'requirement_analysis', label: 'Requirement Analysis', model: 'claude-opus-4-6',   status: 'idle', output: null, duration_ms: null, started_at: null, finished_at: null },
  { id: 's3', name: 'implementation',       label: 'Implementation',       model: 'claude-sonnet-4-6', status: 'idle', output: null, duration_ms: null, started_at: null, finished_at: null },
  { id: 's4', name: 'testing',              label: 'Testing',              model: 'claude-sonnet-4-6', status: 'idle', output: null, duration_ms: null, started_at: null, finished_at: null },
  { id: 's5', name: 'pr_submission',        label: 'PR Submission',        model: 'claude-haiku-4-5',  status: 'idle', output: null, duration_ms: null, started_at: null, finished_at: null },
];

const IDLE_RUN: OrchestratorRun = {
  id: null, status: 'idle', stages: DEFAULT_STAGES,
  bounty_id: null, pr_url: null, error: null,
  started_at: null, finished_at: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3_000;

export function useAgentOrchestration() {
  const [run, setRun] = useState<OrchestratorRun>(IDLE_RUN);
  const [isStarting, setIsStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/agent-runs/${runId}`);
      if (!res.ok) return;
      const data: OrchestratorRun = await res.json();
      setRun(data);
      if (data.status === 'completed' || data.status === 'failed') {
        stopPolling();
      }
    } catch {
      // ignore transient errors
    }
  }, [stopPolling]);

  const startRun = useCallback(async () => {
    setIsStarting(true);
    try {
      const res = await fetch('/api/agent-runs', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start run');
      const data: OrchestratorRun = await res.json();
      setRun(data);
      pollRef.current = setInterval(() => pollStatus(data.id!), POLL_INTERVAL_MS);
    } catch (err) {
      setRun((prev) => ({ ...prev, status: 'failed', error: String(err) }));
    } finally {
      setIsStarting(false);
    }
  }, [pollStatus]);

  const stopRun = useCallback(async () => {
    stopPolling();
    if (!run.id) return;
    try {
      await fetch(`/api/agent-runs/${run.id}/stop`, { method: 'POST' });
    } catch {
      // best-effort
    }
    setRun((prev) => ({ ...prev, status: 'failed', error: 'Stopped by user' }));
  }, [run.id, stopPolling]);

  const retryRun = useCallback(() => {
    setRun(IDLE_RUN);
    startRun();
  }, [startRun]);

  return { run, startRun, stopRun, retryRun, isStarting };
}
