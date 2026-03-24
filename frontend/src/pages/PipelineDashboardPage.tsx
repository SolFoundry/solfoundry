/**
 * PipelineDashboardPage -- CI/CD pipeline monitoring dashboard.
 *
 * Displays pipeline run history, stage statuses, deployment records,
 * and aggregate statistics. Fetches data from the pipeline API using
 * React Query for caching and refetching.
 *
 * @module pages/PipelineDashboardPage
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { PipelineRunList } from '../components/pipelines/PipelineRunList';
import { PipelineStats } from '../components/pipelines/PipelineStats';
import { DeploymentHistory } from '../components/pipelines/DeploymentHistory';
import { EnvironmentConfigs } from '../components/pipelines/EnvironmentConfigs';

/** Shape of a single pipeline stage from the API. */
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

/** Shape of a pipeline run from the API. */
export interface PipelineRun {
  id: string;
  repository: string;
  branch: string;
  commit_sha: string;
  trigger: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
  stages: PipelineStage[];
}

/** Shape of a deployment record from the API. */
export interface DeploymentRecord {
  id: string;
  environment: string;
  version: string;
  program_id: string | null;
  deployed_at: string;
  rollback_version: string | null;
  status: string;
}

/** Shape of pipeline statistics from the API. */
export interface PipelineStatistics {
  total_runs: number;
  status_counts: Record<string, number>;
  average_duration_seconds: number | null;
  success_rate: number;
}

/** Paginated response from the pipeline runs API. */
interface PipelineRunsResponse {
  items: PipelineRun[];
  total: number;
  limit: number;
  offset: number;
}

/** Paginated response from the deployments API. */
interface DeploymentsResponse {
  items: DeploymentRecord[];
  total: number;
  limit: number;
  offset: number;
}

/** Active tab options for the dashboard. */
type DashboardTab = 'runs' | 'deployments' | 'environments';

/**
 * CI/CD Pipeline Dashboard page component.
 *
 * Provides a tabbed interface for viewing pipeline runs, deployment
 * history, and environment configurations. Statistics are displayed
 * at the top regardless of active tab.
 */
export default function PipelineDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('runs');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const statsQuery = useQuery<PipelineStatistics>({
    queryKey: ['pipeline-stats'],
    queryFn: () => apiClient<PipelineStatistics>('/api/pipelines/stats'),
    refetchInterval: 30_000,
  });

  const runsQuery = useQuery<PipelineRunsResponse>({
    queryKey: ['pipeline-runs', statusFilter],
    queryFn: () =>
      apiClient<PipelineRunsResponse>('/api/pipelines/runs', {
        params: { status: statusFilter || undefined, limit: 20 },
      }),
    refetchInterval: 15_000,
    enabled: activeTab === 'runs',
  });

  const deploymentsQuery = useQuery<DeploymentsResponse>({
    queryKey: ['pipeline-deployments'],
    queryFn: () =>
      apiClient<DeploymentsResponse>('/api/pipelines/deployments', {
        params: { limit: 20 },
      }),
    refetchInterval: 30_000,
    enabled: activeTab === 'deployments',
  });

  const environmentsQuery = useQuery<Record<string, unknown>>({
    queryKey: ['pipeline-environments'],
    queryFn: () =>
      apiClient<Record<string, unknown>>('/api/pipelines/environments'),
    enabled: activeTab === 'environments',
  });

  const tabs: { key: DashboardTab; label: string }[] = [
    { key: 'runs', label: 'Pipeline Runs' },
    { key: 'deployments', label: 'Deployments' },
    { key: 'environments', label: 'Environments' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white font-mono">
          CI/CD Pipeline Dashboard
        </h1>
        <p className="mt-2 text-gray-400">
          Monitor pipeline runs, deployments, and environment configurations.
        </p>
      </div>

      {/* Statistics */}
      <PipelineStats
        stats={statsQuery.data ?? null}
        isLoading={statsQuery.isLoading}
      />

      {/* Tab Navigation */}
      <div className="mt-8 border-b border-white/10">
        <nav className="flex gap-6" aria-label="Pipeline dashboard tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-[#9945FF] border-b-2 border-[#9945FF]'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'runs' && (
          <div>
            {/* Status Filter */}
            <div className="mb-4 flex gap-2">
              {['', 'queued', 'running', 'success', 'failure', 'cancelled'].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-[#9945FF]/20 text-[#9945FF] ring-1 ring-[#9945FF]/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {status || 'All'}
                  </button>
                )
              )}
            </div>
            <PipelineRunList
              runs={runsQuery.data?.items ?? []}
              isLoading={runsQuery.isLoading}
              total={runsQuery.data?.total ?? 0}
            />
          </div>
        )}

        {activeTab === 'deployments' && (
          <DeploymentHistory
            deployments={deploymentsQuery.data?.items ?? []}
            isLoading={deploymentsQuery.isLoading}
            total={deploymentsQuery.data?.total ?? 0}
          />
        )}

        {activeTab === 'environments' && (
          <EnvironmentConfigs
            data={environmentsQuery.data ?? null}
            isLoading={environmentsQuery.isLoading}
          />
        )}
      </div>
    </div>
  );
}
