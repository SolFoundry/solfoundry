import { describe, it, expect } from 'vitest';
import { sortAgents } from '../../lib/agents';
import { Agent } from '../../lib/agents';

describe('sortAgents', () => {
  const mockAgents: Agent[] = [
    {
      id: '1',
      name: 'Alpha',
      avatar: '',
      role: 'frontend',
      status: 'available',
      description: '',
      capabilities: [],
      pastWork: [],
      performanceHistory: [],
      successRate: 0.9,
      bountiesCompleted: 10,
      pricing: { model: 'per-bounty', amount: 300, currency: '$FNDRY' }
    },
    {
      id: '2',
      name: 'Beta',
      avatar: '',
      role: 'backend',
      status: 'working',
      description: '',
      capabilities: [],
      pastWork: [],
      performanceHistory: [],
      successRate: 0.8,
      bountiesCompleted: 50,
      pricing: { model: 'per-bounty', amount: 100, currency: '$FNDRY' }
    },
    {
      id: '3',
      name: 'Charlie',
      avatar: '',
      role: 'security',
      status: 'available',
      description: '',
      capabilities: [],
      pastWork: [],
      performanceHistory: [],
      successRate: 0.95,
      bountiesCompleted: 5,
      pricing: { model: 'per-bounty', amount: 200, currency: '$FNDRY' }
    },
  ];

  it('sorts by successRate asc', () => {
    const result = sortAgents([...mockAgents], 'successRate', 'asc');
    expect(result[0].id).toBe('2'); // 0.8
    expect(result[1].id).toBe('1'); // 0.9
    expect(result[2].id).toBe('3'); // 0.95
  });

  it('sorts by successRate desc', () => {
    const result = sortAgents([...mockAgents], 'successRate', 'desc');
    expect(result[0].id).toBe('3'); // 0.95
    expect(result[1].id).toBe('1'); // 0.9
    expect(result[2].id).toBe('2'); // 0.8
  });

  it('sorts by bountiesCompleted asc', () => {
    const result = sortAgents([...mockAgents], 'bountiesCompleted', 'asc');
    expect(result[0].id).toBe('3'); // 5
    expect(result[1].id).toBe('1'); // 10
    expect(result[2].id).toBe('2'); // 50
  });

  it('sorts by bountiesCompleted desc', () => {
    const result = sortAgents([...mockAgents], 'bountiesCompleted', 'desc');
    expect(result[0].id).toBe('2'); // 50
    expect(result[1].id).toBe('1'); // 10
    expect(result[2].id).toBe('3'); // 5
  });

  it('sorts by pricing asc', () => {
    const result = sortAgents([...mockAgents], 'pricing', 'asc');
    expect(result[0].id).toBe('2'); // 100
    expect(result[1].id).toBe('3'); // 200
    expect(result[2].id).toBe('1'); // 300
  });
  
  it('does not mutate original array', () => {
    const original = [...mockAgents];
    sortAgents(original, 'pricing', 'asc');
    expect(original[0].id).toBe('1');
  });
});