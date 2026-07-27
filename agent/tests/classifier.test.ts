import { describe, it, expect } from 'vitest';
import { classifyBounties, DEFAULT_CAPABILITIES } from '../src/classifier.js';

describe('classifier', () => {
  function bounty(
    id = 'uuid',
    category: string | null = 'backend',
    skills: string[] = ['typescript'],
    title = 'Fix endpoint',
  ) {
    return {
      id,
      issueNumber: null,
      title,
      description: 'Fix the endpoint',
      category,
      rewardAmount: 100,
      requiredSkills: skills,
      matchedSkills: [],
      feasibilityScore: 0,
      matchedCapability: null,
    };
  }

  it('scores a backend bounty with matched skills highly', () => {
    const result = classifyBounties([bounty('1', 'backend', ['typescript', 'rest-api'])]);
    expect(result.length).toBe(1);
    expect(result[0]!.feasibilityScore).toBeGreaterThanOrEqual(0.7);
    expect(result[0]!.matchedCapability).toBe('code-implementation');
  });

  it('filters out bounties the agent cannot cover', () => {
    const unknown: string[] = [];
    for (let i = 0; i < 20; i++) unknown.push(`unknown_skill_${i}`);
    const result = classifyBounties([bounty('1', 'backend', unknown)]);
    expect(result).toHaveLength(0);
  });

  it('accepts a doc bounty with required_skills=none', () => {
    const result = classifyBounties([bounty('1', 'documentation', [])]);
    expect(result.length).toBe(1);
    expect(result[0]!.feasibilityScore).toBeCloseTo(1.0);
  });

  it('sorts highest feasibility first', () => {
    const result = classifyBounties([
      bounty('weak', 'backend', ['rust', 'unknown_x']),
      bounty('strong', 'backend', ['typescript', 'python', 'testing']),
    ]);
    expect(result[0]!.id).toBe('strong');
  });

  it('handles unknown category with matched skills', () => {
    const caps = DEFAULT_CAPABILITIES.map((c) => ({
      ...c,
      skills: [...c.skills],
      supportedCategories: [...c.supportedCategories],
    }));
    const result = classifyBounties(
      [bounty('1', 'unknown-category', ['typescript'])],
      caps,
    );
    expect(result.length).toBe(1);
    expect(result[0]!.feasibilityScore).toBeGreaterThanOrEqual(0.4);
  });
});
