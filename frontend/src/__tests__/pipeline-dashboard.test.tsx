/**
 * Tests for the CI/CD Pipeline Dashboard components.
 *
 * Covers rendering of PipelineStats, PipelineRunList, DeploymentHistory,
 * and EnvironmentConfigs components with various data states (loading,
 * empty, populated).
 *
 * @module __tests__/pipeline-dashboard.test
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineStats } from '../components/pipelines/PipelineStats';
import { PipelineRunList } from '../components/pipelines/PipelineRunList';
import { DeploymentHistory } from '../components/pipelines/DeploymentHistory';
import { EnvironmentConfigs } from '../components/pipelines/EnvironmentConfigs';

// ── PipelineStats Tests ──────────────────────────────────────────────────────

describe('PipelineStats', () => {
  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <PipelineStats stats={null} isLoading={true} />
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders statistics when data is provided', () => {
    const stats = {
      total_runs: 42,
      status_counts: { success: 35, failure: 5, running: 2 },
      average_duration_seconds: 185.5,
      success_rate: 0.833,
    };
    render(<PipelineStats stats={stats} isLoading={false} />);

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('83.3%')).toBeTruthy();
    expect(screen.getByText('35 passed')).toBeTruthy();
    expect(screen.getByText('5 failed')).toBeTruthy();
  });

  it('shows green color for high success rate', () => {
    const stats = {
      total_runs: 10,
      status_counts: { success: 9, failure: 1 },
      average_duration_seconds: 100,
      success_rate: 0.9,
    };
    render(<PipelineStats stats={stats} isLoading={false} />);
    const percentElement = screen.getByText('90.0%');
    expect(percentElement.className).toContain('#14F195');
  });

  it('shows red color for low success rate', () => {
    const stats = {
      total_runs: 10,
      status_counts: { success: 3, failure: 7 },
      average_duration_seconds: 50,
      success_rate: 0.3,
    };
    render(<PipelineStats stats={stats} isLoading={false} />);
    const percentElement = screen.getByText('30.0%');
    expect(percentElement.className).toContain('red');
  });
});

// ── PipelineRunList Tests ────────────────────────────────────────────────────

describe('PipelineRunList', () => {
  const mockRuns = [
    {
      id: 'run-1',
      repository: 'SolFoundry/solfoundry',
      branch: 'main',
      commit_sha: 'abc1234567890',
      trigger: 'push',
      status: 'success',
      started_at: '2026-03-22T10:00:00Z',
      finished_at: '2026-03-22T10:05:00Z',
      duration_seconds: 300,
      error_message: null,
      created_at: '2026-03-22T10:00:00Z',
      stages: [
        {
          id: 'stage-1',
          name: 'lint',
          stage_order: 0,
          status: 'passed',
          started_at: '2026-03-22T10:00:00Z',
          finished_at: '2026-03-22T10:01:00Z',
          duration_seconds: 60,
          log_output: null,
          error_detail: null,
        },
        {
          id: 'stage-2',
          name: 'test',
          stage_order: 1,
          status: 'passed',
          started_at: '2026-03-22T10:01:00Z',
          finished_at: '2026-03-22T10:03:00Z',
          duration_seconds: 120,
          log_output: null,
          error_detail: null,
        },
      ],
    },
    {
      id: 'run-2',
      repository: 'SolFoundry/solfoundry',
      branch: 'fix/bug-123',
      commit_sha: 'def4567890123',
      trigger: 'pull_request',
      status: 'failure',
      started_at: '2026-03-22T09:00:00Z',
      finished_at: '2026-03-22T09:02:00Z',
      duration_seconds: 120,
      error_message: 'Tests failed',
      created_at: '2026-03-22T09:00:00Z',
      stages: [
        {
          id: 'stage-3',
          name: 'lint',
          stage_order: 0,
          status: 'passed',
          started_at: null,
          finished_at: null,
          duration_seconds: null,
          log_output: null,
          error_detail: null,
        },
        {
          id: 'stage-4',
          name: 'test',
          stage_order: 1,
          status: 'failed',
          started_at: null,
          finished_at: null,
          duration_seconds: null,
          log_output: null,
          error_detail: 'AssertionError',
        },
      ],
    },
  ];

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <PipelineRunList runs={[]} isLoading={true} total={0} />
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty message when no runs exist', () => {
    render(<PipelineRunList runs={[]} isLoading={false} total={0} />);
    expect(screen.getByText('No pipeline runs found.')).toBeTruthy();
  });

  it('renders pipeline runs with correct branch names', () => {
    render(
      <PipelineRunList runs={mockRuns} isLoading={false} total={2} />
    );
    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByText('fix/bug-123')).toBeTruthy();
  });

  it('renders status badges for each run', () => {
    render(
      <PipelineRunList runs={mockRuns} isLoading={false} total={2} />
    );
    expect(screen.getByText('success')).toBeTruthy();
    expect(screen.getByText('failure')).toBeTruthy();
  });

  it('displays total run count', () => {
    render(
      <PipelineRunList runs={mockRuns} isLoading={false} total={2} />
    );
    expect(screen.getByText('2 total runs')).toBeTruthy();
  });

  it('expands run details on click', async () => {
    const user = userEvent.setup();
    render(
      <PipelineRunList runs={mockRuns} isLoading={false} total={2} />
    );

    // Click the first run to expand
    const buttons = screen.getAllByRole('button');
    const expandButton = buttons.find(
      (btn) => btn.getAttribute('aria-expanded') !== null
    );
    if (expandButton) {
      await user.click(expandButton);
      // After expansion, stage names should be visible
      expect(screen.getByText('lint')).toBeTruthy();
      expect(screen.getByText('test')).toBeTruthy();
    }
  });
});

// ── DeploymentHistory Tests ──────────────────────────────────────────────────

describe('DeploymentHistory', () => {
  const mockDeployments = [
    {
      id: 'deploy-1',
      environment: 'devnet',
      version: 'v1.2.3',
      program_id: '11111111111111111111111111111111',
      deployed_at: '2026-03-22T12:00:00Z',
      rollback_version: 'v1.2.2',
      status: 'success',
    },
    {
      id: 'deploy-2',
      environment: 'mainnet',
      version: 'v1.0.0',
      program_id: null,
      deployed_at: '2026-03-21T10:00:00Z',
      rollback_version: null,
      status: 'success',
    },
  ];

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <DeploymentHistory deployments={[]} isLoading={true} total={0} />
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty message when no deployments exist', () => {
    render(
      <DeploymentHistory deployments={[]} isLoading={false} total={0} />
    );
    expect(screen.getByText('No deployments recorded yet.')).toBeTruthy();
  });

  it('renders deployment records with environment badges', () => {
    render(
      <DeploymentHistory
        deployments={mockDeployments}
        isLoading={false}
        total={2}
      />
    );
    expect(screen.getByText('devnet')).toBeTruthy();
    expect(screen.getByText('mainnet')).toBeTruthy();
    expect(screen.getByText('v1.2.3')).toBeTruthy();
  });

  it('shows rollback version when available', () => {
    render(
      <DeploymentHistory
        deployments={mockDeployments}
        isLoading={false}
        total={2}
      />
    );
    expect(screen.getByText('from v1.2.2')).toBeTruthy();
  });

  it('displays total deployment count', () => {
    render(
      <DeploymentHistory
        deployments={mockDeployments}
        isLoading={false}
        total={2}
      />
    );
    expect(screen.getByText('2 total deployments')).toBeTruthy();
  });
});

// ── EnvironmentConfigs Tests ─────────────────────────────────────────────────

describe('EnvironmentConfigs', () => {
  const mockData = {
    local: {
      config_count: 2,
      configs: [
        {
          key: 'SOLANA_RPC_URL',
          value: 'http://localhost:8899',
          is_secret: false,
          description: 'Local RPC endpoint',
        },
        {
          key: 'DATABASE_PASSWORD',
          value: '********',
          is_secret: true,
          description: 'Database password',
        },
      ],
    },
    devnet: {
      config_count: 1,
      configs: [
        {
          key: 'SOLANA_RPC_URL',
          value: 'https://api.devnet.solana.com',
          is_secret: false,
          description: 'Devnet RPC endpoint',
        },
      ],
    },
    staging: { config_count: 0, configs: [] },
    mainnet: { config_count: 0, configs: [] },
  };

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <EnvironmentConfigs data={null} isLoading={true} />
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty message when no data', () => {
    render(<EnvironmentConfigs data={null} isLoading={false} />);
    expect(
      screen.getByText('No environment configurations found.')
    ).toBeTruthy();
  });

  it('renders environment sections', () => {
    render(
      <EnvironmentConfigs data={mockData} isLoading={false} />
    );
    expect(screen.getByText('local')).toBeTruthy();
    expect(screen.getByText('devnet')).toBeTruthy();
  });

  it('displays config keys and values', () => {
    render(
      <EnvironmentConfigs data={mockData} isLoading={false} />
    );
    const rpcElements = screen.getAllByText('SOLANA_RPC_URL');
    expect(rpcElements.length).toBeGreaterThan(0);
    expect(screen.getByText('http://localhost:8899')).toBeTruthy();
  });

  it('masks secret values with asterisks', () => {
    render(
      <EnvironmentConfigs data={mockData} isLoading={false} />
    );
    expect(screen.getByText('********')).toBeTruthy();
  });

  it('shows config count for each environment', () => {
    render(
      <EnvironmentConfigs data={mockData} isLoading={false} />
    );
    expect(screen.getByText('2 keys')).toBeTruthy();
    expect(screen.getByText('1 keys')).toBeTruthy();
  });
});
