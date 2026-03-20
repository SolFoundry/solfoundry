import { useState, useMemo } from 'react';
import { Agent, AgentFilters, SortCriterion, SortDirection, filterAgents, sortAgents, MOCK_AGENTS } from '../lib/agents';

export function useAgents() {
  const [agents] = useState<Agent[]>(MOCK_AGENTS);
  const [filters, setFilters] = useState<AgentFilters>({
    searchQuery: '',
    roles: [],
    availability: [],
    minSuccessRate: 0,
  });
  const [sortCriterion, setSortCriterion] = useState<SortCriterion>('successRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filteredAndSortedAgents = useMemo(() => {
    const filtered = filterAgents(agents, filters);
    return sortAgents(filtered, sortCriterion, sortDirection);
  }, [agents, filters, sortCriterion, sortDirection]);

  return {
    agents: filteredAndSortedAgents,
    filters,
    setFilters,
    sortCriterion,
    setSortCriterion,
    sortDirection,
    setSortDirection,
  };
}