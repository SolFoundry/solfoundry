import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PipelineStats } from '../components/pipelines/PipelineStats';
import { PipelineRunList } from '../components/pipelines/PipelineRunList';
import { DeploymentHistory } from '../components/pipelines/DeploymentHistory';
import { EnvironmentConfigs } from '../components/pipelines/EnvironmentConfigs';

async function fetchPipelineStats() {
  const res = await fetch('/api/pipeline/stats');
  if (!res.ok) return null;
  return res.json();
}

async function fetchPipelineRuns() {
  const res = await fetch('/api/pipeline/runs');
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

async function fetchDeployments() {
  const res = await fetch('/api/pipeline/deployments');
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

async function fetchEnvConfigs() {
  const res = await fetch('/api/pipeline/env-configs');
  if (!res.ok) return null;
  return res.json();
}

export function PipelineDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pipeline-stats'], queryFn: fetchPipelineStats, staleTime: 30_000,
  });
  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['pipeline-runs'], queryFn: fetchPipelineRuns, staleTime: 15_000,
  });
  const { data: deploymentsData, isLoading: deploysLoading } = useQuery({
    queryKey: ['pipeline-deployments'], queryFn: fetchDeployments, staleTime: 30_000,
  });
  const { data: envData, isLoading: envLoading } = useQuery({
    queryKey: ['pipeline-env-configs'], queryFn: fetchEnvConfigs, staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white px-6 py-16 max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-2">CI/CD Pipeline</h1>
        <p className="text-white/50 text-sm">Build runs, deployments, and environment configuration.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-white/70 mb-4">Overview</h2>
        <PipelineStats stats={stats ?? null} isLoading={statsLoading} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white/70 mb-4">Recent Runs</h2>
        <PipelineRunList
          runs={runsData?.items ?? []}
          isLoading={runsLoading}
          total={runsData?.total ?? 0}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white/70 mb-4">Deployment History</h2>
        <DeploymentHistory
          deployments={deploymentsData?.items ?? []}
          isLoading={deploysLoading}
          total={deploymentsData?.total ?? 0}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white/70 mb-4">Environment Config</h2>
        <EnvironmentConfigs data={envData ?? null} isLoading={envLoading} />
      </section>
    </div>
  );
}
