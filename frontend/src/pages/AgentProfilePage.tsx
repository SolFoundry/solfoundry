/**
 * Route for /agents/:agentId -- React Query fetch via apiClient.
 * @module pages/AgentProfilePage
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AgentProfile } from '../components/agents/AgentProfile';
import { AgentProfileSkeleton } from '../components/agents/AgentProfileSkeleton';
import { AgentNotFound } from '../components/agents/AgentNotFound';
import { apiClient, isApiError } from '../services/apiClient';
import { AGENT_ROLE_VALUES, type AgentApiRole } from '../services/agentsApi';
import type { AgentProfile as AgentProfileType, AgentActivityEntry, CompletedBounty } from '../types/agent';
import { agentInitials } from '../types/agent';

function mapStatus(isActive: boolean, availability: string): AgentProfileType['status'] {
  if (!isActive) return 'offline';
  if (availability === 'available') return 'available';
  return 'busy';
}

/** Map GET /api/agents/:id JSON to UI profile model. */
function mapAgentResponse(response: Record<string, unknown>): AgentProfileType {
  const roleRaw = String(response.role ?? '');
  const role = (AGENT_ROLE_VALUES as readonly string[]).includes(roleRaw)
    ? (roleRaw as AgentApiRole)
    : 'ai-engineer';

  const caps = Array.isArray(response.capabilities) ? (response.capabilities as string[]) : [];
  const langs = Array.isArray(response.languages) ? (response.languages as string[]) : [];
  const apis = Array.isArray(response.apis) ? (response.apis as string[]) : [];

  const completedRaw = Array.isArray(response.completed_bounties)
    ? (response.completed_bounties as Record<string, unknown>[])
    : [];
  const completedBounties: CompletedBounty[] = completedRaw.map((b) => ({
    id: String(b.id ?? ''),
    title: String(b.title ?? ''),
    completedAt: String(b.completed_at ?? ''),
    score: Number(b.score ?? 0),
    reward: Number(b.reward ?? 0),
    currency: String(b.currency ?? '$FNDRY'),
  }));

  const activityRaw = Array.isArray(response.activity_log)
    ? (response.activity_log as Record<string, unknown>[])
    : [];
  const activityLog: AgentActivityEntry[] = activityRaw.map((e) => ({
    ts: String(e.ts ?? ''),
    type: String(e.type ?? 'event'),
    message: String(e.message ?? ''),
  }));

  const isActive = Boolean(response.is_active ?? true);
  const availability = String(response.availability ?? 'offline');
  const name = String(response.name ?? '');

  return {
    id: String(response.id ?? ''),
    name,
    avatar: agentInitials(name || 'AI'),
    role,
    status: mapStatus(isActive, availability),
    bio: String(response.bio ?? response.description ?? ''),
    skills: caps,
    languages: langs,
    apis,
    bountiesCompleted: Number(response.bounties_completed ?? 0),
    successRate: Number(response.success_rate ?? 0),
    avgReviewScore: Number(response.avg_review_score ?? 0),
    totalEarned: Number(response.total_earned ?? 0),
    completedBounties,
    joinedAt: String(response.joined_at ?? response.created_at ?? ''),
    verified: Boolean(response.verified),
    apiEndpoint:
      response.api_endpoint === null || response.api_endpoint === undefined
        ? null
        : String(response.api_endpoint),
    reputationScore: Number(response.reputation_score ?? 0),
    activityLog,
    operatorWallet: String(response.operator_wallet ?? ''),
  };
}

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();

  const { data: agent, isLoading, isError, error } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const data = await apiClient<Record<string, unknown>>(`/api/agents/${encodeURIComponent(agentId!)}`, {
        retries: 1,
      });
      return mapAgentResponse(data);
    },
    enabled: Boolean(agentId),
    retry: false,
    refetchInterval: 12_000,
  });

  if (!agentId) return <AgentNotFound />;
  if (isLoading) return <AgentProfileSkeleton />;
  if (isError) {
    if (isApiError(error) && error.status === 404) {
      return <AgentNotFound />;
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to load agent profile';
    return (
      <div className="mx-auto max-w-3xl p-6" role="alert">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="mb-2 font-semibold text-red-400">Failed to load agent profile</p>
          <p className="mb-4 text-sm text-gray-400">{errorMessage}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-solana-purple/20 px-4 py-2 text-sm text-solana-purple hover:bg-solana-purple/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!agent) return <AgentNotFound />;
  return <AgentProfile agent={agent} />;
}
