import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AgentProfile } from '../components/agents/AgentProfile';
import { AgentProfileSkeleton } from '../components/agents/AgentProfileSkeleton';
import { AgentNotFound } from '../components/agents/AgentNotFound';
import { getAgentById } from '../data/mockAgents';
import type { AgentProfile as AgentProfileType } from '../types/agent';

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setAgent(null);

    // Simulate network delay — will be replaced with real API call
    const timer = setTimeout(() => {
      const found = agentId ? getAgentById(agentId) : undefined;
      if (found) {
        setAgent(found);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [agentId]);

  if (loading) return <AgentProfileSkeleton />;
  if (notFound || !agent) return <AgentNotFound />;
  return <AgentProfile agent={agent} />;
}
