/**
 * Tests for the autonomous multi-agent orchestration system.
 *
 * Validates the AgentOrchestrator component: pipeline stage rendering,
 * LLM agent assignments, run controls, stage status progression,
 * and PR submission output.
 *
 * @module __tests__/agent-orchestrator.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../hooks/useAgentOrchestration', () => ({
  useAgentOrchestration: vi.fn(),
}));

import { AgentOrchestrator } from '../components/agents/AgentOrchestrator';
import { useAgentOrchestration } from '../hooks/useAgentOrchestration';
import type { OrchestratorRun, PipelineStage } from '../hooks/useAgentOrchestration';

const mockUseAgentOrchestration = useAgentOrchestration as ReturnType<typeof vi.fn>;

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IDLE_STAGES: PipelineStage[] = [
  { id: 's1', name: 'bounty_scout',           label: 'Bounty Scout',            model: 'claude-opus-4-6',   status: 'idle',      output: null, duration_ms: null, started_at: null, finished_at: null },
  { id: 's2', name: 'requirement_analysis',   label: 'Requirement Analysis',    model: 'claude-opus-4-6',   status: 'idle',      output: null, duration_ms: null, started_at: null, finished_at: null },
  { id: 's3', name: 'implementation',         label: 'Implementation',          model: 'claude-sonnet-4-6', status: 'idle',      output: null, duration_ms: null, started_at: null, finished_at: null },
  { id: 's4', name: 'testing',                label: 'Testing',                 model: 'claude-sonnet-4-6', status: 'idle',      output: null, duration_ms: null, started_at: null, finished_at: null },
  { id: 's5', name: 'pr_submission',          label: 'PR Submission',           model: 'claude-haiku-4-5',  status: 'idle',      output: null, duration_ms: null, started_at: null, finished_at: null },
];

const RUNNING_STAGES: PipelineStage[] = [
  { ...IDLE_STAGES[0], status: 'completed', output: 'Found 3 bounties. Selected: Fix escrow bug (#42)', duration_ms: 1200, started_at: '2026-04-04T10:00:00Z', finished_at: '2026-04-04T10:00:01Z' },
  { ...IDLE_STAGES[1], status: 'completed', output: 'Requirements: patch escrow release logic. Files: programs/escrow/src/lib.rs', duration_ms: 2100, started_at: '2026-04-04T10:00:01Z', finished_at: '2026-04-04T10:00:03Z' },
  { ...IDLE_STAGES[2], status: 'running',   output: null, duration_ms: null, started_at: '2026-04-04T10:00:03Z', finished_at: null },
  { ...IDLE_STAGES[3], status: 'idle',      output: null, duration_ms: null, started_at: null, finished_at: null },
  { ...IDLE_STAGES[4], status: 'idle',      output: null, duration_ms: null, started_at: null, finished_at: null },
];

const COMPLETED_STAGES: PipelineStage[] = IDLE_STAGES.map((s, i) => ({
  ...s,
  status: 'completed' as const,
  duration_ms: (i + 1) * 1500,
  started_at: '2026-04-04T10:00:00Z',
  finished_at: '2026-04-04T10:00:10Z',
  output: i === 4 ? 'PR #99 submitted: https://github.com/SolFoundry/solfoundry/pull/99' : 'Done',
}));

const FAILED_STAGES: PipelineStage[] = [
  { ...RUNNING_STAGES[0], status: 'completed' },
  { ...RUNNING_STAGES[1], status: 'completed' },
  { ...IDLE_STAGES[2], status: 'failed', output: 'Error: cargo build failed — unused variable `x`', duration_ms: 800, started_at: '2026-04-04T10:00:03Z', finished_at: '2026-04-04T10:00:04Z' },
  { ...IDLE_STAGES[3], status: 'idle' },
  { ...IDLE_STAGES[4], status: 'idle' },
];

const idleRun: OrchestratorRun = {
  id: null, status: 'idle', stages: IDLE_STAGES,
  bounty_id: null, pr_url: null, error: null,
  started_at: null, finished_at: null,
};

const runningRun: OrchestratorRun = {
  id: 'run-001', status: 'running', stages: RUNNING_STAGES,
  bounty_id: 'bounty-42', pr_url: null, error: null,
  started_at: '2026-04-04T10:00:00Z', finished_at: null,
};

const completedRun: OrchestratorRun = {
  id: 'run-002', status: 'completed', stages: COMPLETED_STAGES,
  bounty_id: 'bounty-42',
  pr_url: 'https://github.com/SolFoundry/solfoundry/pull/99',
  error: null,
  started_at: '2026-04-04T10:00:00Z', finished_at: '2026-04-04T10:00:15Z',
};

const failedRun: OrchestratorRun = {
  id: 'run-003', status: 'failed', stages: FAILED_STAGES,
  bounty_id: 'bounty-42', pr_url: null,
  error: 'Implementation stage failed',
  started_at: '2026-04-04T10:00:00Z', finished_at: '2026-04-04T10:00:04Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentOrchestrator', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders heading and description', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: idleRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByText('Autonomous Agent')).toBeDefined();
    expect(screen.getByText(/finds bounties/i)).toBeDefined();
  });

  it('renders all 5 pipeline stages', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: idleRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByText('Bounty Scout')).toBeDefined();
    expect(screen.getByText('Requirement Analysis')).toBeDefined();
    expect(screen.getByText('Implementation')).toBeDefined();
    expect(screen.getByText('Testing')).toBeDefined();
    expect(screen.getByText('PR Submission')).toBeDefined();
  });

  it('shows LLM model assigned to each stage', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: idleRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    const opusEls = screen.getAllByText('claude-opus-4-6');
    expect(opusEls.length).toBe(2);
    const sonnetEls = screen.getAllByText('claude-sonnet-4-6');
    expect(sonnetEls.length).toBe(2);
    expect(screen.getByText('claude-haiku-4-5')).toBeDefined();
  });

  it('shows Start Run button when idle', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: idleRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByRole('button', { name: /start run/i })).toBeDefined();
  });

  it('calls startRun when Start Run is clicked', async () => {
    const startRun = vi.fn();
    mockUseAgentOrchestration.mockReturnValue({
      run: idleRun, startRun, stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    const u = userEvent.setup();
    render(<AgentOrchestrator />, { wrapper: wrap() });
    await u.click(screen.getByRole('button', { name: /start run/i }));
    expect(startRun).toHaveBeenCalledOnce();
  });

  it('shows Stop button when run is in progress', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: runningRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByRole('button', { name: /stop/i })).toBeDefined();
  });

  it('marks completed and running stages correctly', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: runningRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByTestId('stage-status-s1')).toHaveTextContent('completed');
    expect(screen.getByTestId('stage-status-s2')).toHaveTextContent('completed');
    expect(screen.getByTestId('stage-status-s3')).toHaveTextContent('running');
  });

  it('shows stage output when available', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: runningRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByText(/Found 3 bounties/i)).toBeDefined();
  });

  it('shows PR link when run completes successfully', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: completedRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByTestId('pr-link')).toBeDefined();
    expect(screen.getByTestId('pr-link')).toHaveAttribute(
      'href',
      'https://github.com/SolFoundry/solfoundry/pull/99',
    );
  });

  it('shows error message and Retry button when run fails', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: failedRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByTestId('run-error')).toHaveTextContent('Implementation stage failed');
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('calls retryRun when Retry is clicked after failure', async () => {
    const retryRun = vi.fn();
    mockUseAgentOrchestration.mockReturnValue({
      run: failedRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun, isStarting: false,
    });
    const u = userEvent.setup();
    render(<AgentOrchestrator />, { wrapper: wrap() });
    await u.click(screen.getByRole('button', { name: /retry/i }));
    expect(retryRun).toHaveBeenCalledOnce();
  });

  it('disables Start Run while a run is in progress', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: runningRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    // Start Run button should not be rendered when running
    expect(screen.queryByRole('button', { name: /start run/i })).toBeNull();
  });

  it('shows "Run completed" summary on success', () => {
    mockUseAgentOrchestration.mockReturnValue({
      run: completedRun, startRun: vi.fn(), stopRun: vi.fn(), retryRun: vi.fn(), isStarting: false,
    });
    render(<AgentOrchestrator />, { wrapper: wrap() });
    expect(screen.getByTestId('run-summary')).toHaveTextContent(/completed/i);
  });
});
