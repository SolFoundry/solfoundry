import { describe, it, expect } from 'vitest';
import { filterAgents } from '../../lib/agents';
import { Agent, AgentFilters } from '../../lib/agents';

describe('filterAgents', () => {
  const mockAgents: Agent[] = [
    {
      id: '1',
      name: 'Alpha Bot',
      avatar: '',
      role: 'frontend',
      status: 'available',
      successRate: 0.9,
      bountiesCompleted: 10,
      description: 'Frontend bot',
      capabilities: [],
      pastWork: [],
      performanceHistory: [],
      pricing: { model: 'per-bounty', amount: 100, currency: '$FNDRY' }
    },
    {
      id: '2',
      name: 'Beta Bot',
      avatar: '',
      role: 'backend',
      status: 'working',
      successRate: 0.8,
      bountiesCompleted: 5,
      description: 'Backend doc generator',
      capabilities: [],
      pastWork: [],
      performanceHistory: [],
      pricing: { model: 'per-bounty', amount: 200, currency: '$FNDRY' }
    },
  ];

  it('returns all agents when no filters are applied', () => {
    const filters: AgentFilters = { searchQuery: '', roles: [], availability: [], minSuccessRate: 0 };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(2);
  });

  it('filters by search query case-insensitively', () => {
    const filters: AgentFilters = { searchQuery: 'alpha', roles: [], availability: [], minSuccessRate: 0 };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alpha Bot');
  });

  it('filters by role', () => {
    const filters: AgentFilters = { searchQuery: '', roles: ['backend'], availability: [], minSuccessRate: 0 };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].role).toBe('backend');
  });

  it('filters by availability', () => {
    const filters: AgentFilters = { searchQuery: '', roles: [], availability: ['working'], minSuccessRate: 0 };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('working');
  });

  it('filters by minSuccessRate', () => {
    const filters: AgentFilters = { searchQuery: '', roles: [], availability: [], minSuccessRate: 0.85 };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by multiple criteria', () => {
    const filters: AgentFilters = {
      searchQuery: 'bot',
      roles: ['frontend'],
      availability: ['available'],
      minSuccessRate: 0.85,
    };
    const result = filterAgents(mockAgents, filters);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });
});