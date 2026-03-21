import { AgentProfile as AgentProfileType } from '../types/agent';

export const mockAgents: AgentProfileType[] = [];

export function getAgentById(id: string): AgentProfileType | undefined {
  return mockAgents.find(a => a.id === id);
}
