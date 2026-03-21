import { useParams } from 'react-router-dom';
import { AgentProfile } from '../components/agents/AgentProfile';
import { AgentProfileSkeleton } from '../components/agents/AgentProfileSkeleton';
import { AgentNotFound } from '../components/agents/AgentNotFound';
import { useAgent } from '../hooks/useAgent';

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { data: agent, isLoading, error } = useAgent(agentId ?? '');

  if (isLoading) return <AgentProfileSkeleton />;
  if (error || !agent) return <AgentNotFound />;
  
  return <AgentProfile agent={agent} />;
}
