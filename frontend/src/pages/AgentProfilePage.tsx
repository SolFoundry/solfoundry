/**
 * Route for /agents/:agentId -- React Query fetch via apiClient.
 * @module pages/AgentProfilePage
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AgentProfile } from '../components/agents/AgentProfile';
import { AgentProfileSkeleton } from '../components/agents/AgentProfileSkeleton';
import { AgentNotFound } from '../components/agents/AgentNotFound';
import { apiClient, isApiError, ApiError } from '../services/apiClient';
import type { AgentProfile as AgentProfileType } from '../types/agent';

const VALID_ROLES: readonly string[] = ['auditor', 'developer', 'researcher', 'optimizer'];
const API_STATUS_MAP: Record<string, 'available' | 'busy' | 'offline'> = {
  online: 'available',
  available: 'available',
  busy: 'busy',
  idle: 'offline',
  offline: 'offline',
};

/** Map raw API response to AgentProfile with validated enum fields. */
function mapAgentResponse(response: Record<string, unknown>): AgentProfileType {
  const completedBounties = Array.isArray(response.completed_bounties) ? response.completed_bounties as Record<string, unknown>[] : [];
  const role = VALID_ROLES.includes(String(response.role)) ? response.role as AgentProfileType['role'] : 'developer';
  const status = API_STATUS_MAP[String(response.status)] ?? 'offline';
  return {
    id: String(response.id ?? ''),
    name: String(response.name ?? ''),
    avatar: String(response.avatar ?? response.avatar_url ?? ''),
    role,
    status,
    bio: String(response.bio ?? response.description ?? ''),
    skills: (Array.isArray(response.skills) ? response.skills : []) as string[],
    languages: (Array.isArray(response.languages) ? response.languages : []) as string[],
    bountiesCompleted: Number(response.bounties_completed ?? 0),
    successRate: Number(response.success_rate ?? 0),
    avgReviewScore: Number(response.avg_review_score ?? 0),
    totalEarned: Number(response.total_earned ?? 0),
    completedBounties: completedBounties.map(bounty => ({
      id: String(bounty.id ?? ''),
      title: String(bounty.title ?? ''),
      completedAt: String(bounty.completed_at ?? ''),
      score: Number(bounty.score ?? 0),
      reward: Number(bounty.reward ?? 0),
      currency: '$FNDRY',
    })),
    joinedAt: String(response.joined_at ?? response.created_at ?? ''),
  };
}

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();

  const { data: agent, isLoading, isError, error } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const data = await apiClient<Record<string, unknown>>(`/api/agents/${encodeURIComponent(agentId!)}`, { retries: 1 });
      return mapAgentResponse(data);
    },
    enabled: Boolean(agentId),
    retry: false,
  });

  if (!agentId) return <AgentNotFound />;
  if (isLoading) return <AgentProfileSkeleton />;
  if (isError) {
    // Differentiate 404 (agent truly not found) from other server errors
    if (isApiError(error) && error.status === 404) {
      return <AgentNotFound />;
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to load agent profile';
    return (
      <div className="p-6 max-w-3xl mx-auto" role="alert">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-semibold mb-2">Failed to load agent profile</p>
          <p className="text-sm text-gray-400 mb-4">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-solana-purple/20 text-solana-purple hover:bg-solana-purple/30 text-sm"
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
