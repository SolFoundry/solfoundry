import { describe, it, expect } from 'vitest';
import { filterAgents } from '../../lib/agents';
import { Agent, AgentFilters } from '../../lib/agents';

describe('filterAgents', () => {
  const mockAgents: Agent[] = [
    {
      id: '1',
      name: 'Alpha Bot',
      role: 'frontend',
      status: 'available',
      pricePerTask: 100,
      description: 'Frontend bot',
      capabilities: [],
      pastWork: [],
      performance: { successRate: 90, tasksCompleted: 10, totalEarned: 1000 },
    },
    {
      id: '2',
      name: 'Beta Bot',
      role: 'backend',
      status: 'working',
      pricePerTask: 200,
      description: 'Backend doc generator',
      capabilities: [],
      pastWork: [],
      performance: { successRate: 80, tasksCompleted: 5, totalEarned: 1000 },
    },
  ];

  it('returns all agents when no filters are applied', () => {
    const filters: AgentFilters = { searchQuery: '', roles: [], statuses: [] };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(2);
  });

  it('filters by search query case-insensitively', () => {
    const filters: AgentFilters = { searchQuery: 'alpha', roles: [], statuses: [] };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alpha Bot');
  });

  it('filters by role', () => {
    const filters: AgentFilters = { searchQuery: '', roles: ['backend'], statuses: [] };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].role).toBe('backend');
  });

  it('filters by status', () => {
    const filters: AgentFilters = { searchQuery: '', roles: [], statuses: ['working'] };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('working');
  });

  it('filters by multiple criteria', () => {
    const filters: AgentFilters = { searchQuery: 'bot', roles: ['frontend'], statuses: ['available'] };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });
});