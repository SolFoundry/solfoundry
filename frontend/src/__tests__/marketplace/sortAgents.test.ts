import { describe, it, expect } from 'vitest';
import { sortAgents } from '../../lib/agents';
import { Agent } from '../../lib/agents';

describe('sortAgents', () => {
  const mockAgents: Agent[] = [
    {
      id: '1',
      name: 'Alpha',
      role: 'frontend',
      status: 'available',
      pricePerTask: 300,
      description: '',
      capabilities: [],
      pastWork: [],
      performance: { successRate: 90, tasksCompleted: 10, totalEarned: 1000 },
    },
    {
      id: '2',
      name: 'Beta',
      role: 'backend',
      status: 'working',
      pricePerTask: 100,
      description: '',
      capabilities: [],
      pastWork: [],
      performance: { successRate: 80, tasksCompleted: 50, totalEarned: 5000 },
    },
    {
      id: '3',
      name: 'Charlie',
      role: 'security',
      status: 'available',
      pricePerTask: 200,
      description: '',
      capabilities: [],
      pastWork: [],
      performance: { successRate: 95, tasksCompleted: 5, totalEarned: 1000 },
    },
  ];

  it('sorts by recommended (tasksCompleted desc) as default proxy', () => {
    // "recommended" uses tasksCompleted by default in our implementation
    const result = sortAgents([...mockAgents], 'recommended', 'desc');
    expect(result[0].id).toBe('2'); // 50 tasks
    expect(result[1].id).toBe('1'); // 10 tasks
    expect(result[2].id).toBe('3'); // 5 tasks
  });

  it('sorts by successRate asc', () => {
    const result = sortAgents([...mockAgents], 'successRate', 'asc');
    expect(result[0].id).toBe('2'); // 80%
    expect(result[1].id).toBe('1'); // 90%
    expect(result[2].id).toBe('3'); // 95%
  });

  it('sorts by successRate desc', () => {
    const result = sortAgents([...mockAgents], 'successRate', 'desc');
    expect(result[0].id).toBe('3'); // 95%
    expect(result[1].id).toBe('1'); // 90%
    expect(result[2].id).toBe('2'); // 80%
  });

  it('sorts by tasksCompleted asc', () => {
    const result = sortAgents([...mockAgents], 'tasksCompleted', 'asc');
    expect(result[0].id).toBe('3'); // 5
    expect(result[1].id).toBe('1'); // 10
    expect(result[2].id).toBe('2'); // 50
  });

  it('sorts by pricePerTask asc', () => {
    const result = sortAgents([...mockAgents], 'pricePerTask', 'asc');
    expect(result[0].id).toBe('2'); // 100
    expect(result[1].id).toBe('3'); // 200
    expect(result[2].id).toBe('1'); // 300
  });
  
  it('does not mutate original array', () => {
    const original = [...mockAgents];
    sortAgents(original, 'pricePerTask', 'asc');
    expect(original[0].id).toBe('1');
  });
});