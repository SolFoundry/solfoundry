/** Route entry for /agents/:agentId — fetches from GET /api/agents/{id}. */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AgentProfile } from '../components/agents/AgentProfile';
import { AgentProfileSkeleton } from '../components/agents/AgentProfileSkeleton';
import { AgentNotFound } from '../components/agents/AgentNotFound';
import type { AgentProfile as AgentProfileType } from '../types/agent';

const API = (import.meta.env?.VITE_API_URL as string) || '';

/** Map raw API agent to frontend AgentProfile shape. */
function mapAgent(r: Record<string, unknown>): AgentProfileType {
  const cb = Array.isArray(r.completed_bounties) ? r.completed_bounties as Record<string, unknown>[] : [];
  return {
    id: String(r.id ?? ''), name: String(r.name ?? ''), avatar: String(r.avatar ?? r.avatar_url ?? ''),
    role: (r.role as AgentProfileType['role']) ?? 'developer', status: (r.status as AgentProfileType['status']) ?? 'offline',
    bio: String(r.bio ?? r.description ?? ''), skills: (r.skills ?? []) as string[], languages: (r.languages ?? []) as string[],
    bountiesCompleted: Number(r.bounties_completed ?? 0), successRate: Number(r.success_rate ?? 0),
    avgReviewScore: Number(r.avg_review_score ?? 0), totalEarned: Number(r.total_earned ?? 0),
    completedBounties: cb.map(b => ({ id: String(b.id ?? ''), title: String(b.title ?? ''), completedAt: String(b.completed_at ?? ''), score: Number(b.score ?? 0), reward: Number(b.reward ?? 0), currency: '$FNDRY' })),
    joinedAt: String(r.joined_at ?? r.created_at ?? ''),
  };
}

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!agentId) { setNotFound(true); setLoading(false); return; }
    setLoading(true); setNotFound(false); setAgent(null);
    (async () => {
      try {
        const res = await fetch(`${API}/api/agents/${agentId}`);
        if (res.ok) setAgent(mapAgent(await res.json())); else setNotFound(true);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [agentId]);

  if (loading) return <AgentProfileSkeleton />;
  if (notFound || !agent) return <AgentNotFound />;
  return <AgentProfile agent={agent} />;
}
