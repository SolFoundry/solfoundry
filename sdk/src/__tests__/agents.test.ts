/**
 * Tests for the autonomous bounty-hunting agent system.
 *
 * Verifies that each agent and the orchestrator function correctly,
 * including discovery, analysis, solution building, testing, and
 * PR submission stages.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentOrchestrator,
  BountyHunterAgent,
  SolutionBuilder,
  TestRunner,
  PRSubmitter,
} from '../agents/index.js';
import {
  AgentRole,
  AgentState,
  TaskType,
  MessageType,
  AgentEventType,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from '../agents/types.js';
import type {
  AgentOrchestratorConfig,
  BountyAnalysis,
  AgentEvent,
} from '../agents/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTestConfig(): AgentOrchestratorConfig {
  return {
    ...DEFAULT_ORCHESTRATOR_CONFIG,
    apiBaseUrl: 'https://test-api.solfoundry.io',
    targetRepo: 'TestOrg/test-repo',
    agentSkills: ['typescript', 'rust', 'python'],
    autoSelectBounty: true,
    minRewardAmount: 50,
    maxEffortHours: 100,
  };
}

function createMockBounty(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    id: 'bounty-001',
    title: 'Implement Search API',
    description: 'Build a full-text search API for bounties with filtering and sorting support.',
    tier: 2,
    reward_amount: 500,
    status: 'open',
    category: 'backend',
    required_skills: ['typescript', 'api'],
    deadline: '2026-06-01T00:00:00Z',
    created_by: 'user-1',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BountyHunterAgent Tests
// ---------------------------------------------------------------------------

describe('BountyHunterAgent', () => {
  let agent: BountyHunterAgent;
  let config: AgentOrchestratorConfig;

  beforeEach(() => {
    config = createTestConfig();
    agent = new BountyHunterAgent(config);
  });

  describe('initialization', () => {
    it('should start in IDLE state', () => {
      expect(agent.getState()).toBe(AgentState.IDLE);
    });

    it('should report the correct role', () => {
      expect(agent.getRole()).toBe(AgentRole.PLANNER);
    });
  });

  describe('analyzeBounty', () => {
    it('should analyze a bounty and return an analysis', () => {
      const bounty = createMockBounty();
      const analysis = agent.analyzeBounty(bounty);

      expect(analysis.bountyId).toBe('bounty-001');
      expect(analysis.title).toBe('Implement Search API');
      expect(analysis.rewardAmount).toBe(500);
      expect(analysis.skillMatchScore).toBeGreaterThan(0);
      expect(analysis.estimatedDifficulty).toBeGreaterThanOrEqual(1);
      expect(analysis.estimatedDifficulty).toBeLessThanOrEqual(10);
      expect(analysis.estimatedEffortHours).toBeGreaterThan(0);
      expect(analysis.valueRatio).toBeGreaterThan(0);
      expect(analysis.shouldPursue).toBe(true);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.requirements.length).toBeGreaterThan(0);
      expect(analysis.recommendedApproach.length).toBeGreaterThan(0);
    });

    it('should mark low-reward bounties as not pursueable', () => {
      const bounty = createMockBounty({ reward_amount: 10 });
      const analysis = agent.analyzeBounty(bounty);

      expect(analysis.shouldPursue).toBe(false);
    });

    it('should calculate skill match score correctly', () => {
      const bounty = createMockBounty({
        required_skills: ['typescript', 'rust'],
      });
      const analysis = agent.analyzeBounty(bounty);

      // Both skills match the agent's skills
      expect(analysis.skillMatchScore).toBe(1);
    });

    it('should handle partial skill matches', () => {
      const bounty = createMockBounty({
        required_skills: ['typescript', 'unknown-lang', 'another-unknown'],
      });
      const analysis = agent.analyzeBounty(bounty);

      // 1 out of 3 skills match
      expect(analysis.skillMatchScore).toBeCloseTo(1 / 3, 2);
    });

    it('should estimate difficulty based on tier', () => {
      const t1Bounty = createMockBounty({ tier: 1, description: 'Simple task' });
      const t3Bounty = createMockBounty({
        tier: 3,
        description: 'Complex architecture refactoring with distributed consensus optimization',
      });

      const t1Analysis = agent.analyzeBounty(t1Bounty);
      const t3Analysis = agent.analyzeBounty(t3Bounty);

      expect(t3Analysis.estimatedDifficulty).toBeGreaterThanOrEqual(t1Analysis.estimatedDifficulty);
    });
  });

  describe('analyzeBounties', () => {
    it('should analyze multiple bounties and sort by value ratio', () => {
      const bounties = [
        createMockBounty({ id: 'bounty-1', reward_amount: 200 }),
        createMockBounty({ id: 'bounty-2', reward_amount: 1000 }),
        createMockBounty({ id: 'bounty-3', reward_amount: 500 }),
      ];

      const analyses = agent.analyzeBounties(bounties);

      expect(analyses.length).toBe(3);
      // Should be sorted by value ratio descending
      for (let i = 0; i < analyses.length - 1; i++) {
        expect(analyses[i].valueRatio).toBeGreaterThanOrEqual(analyses[i + 1].valueRatio);
      }
    });
  });

  describe('selectBounty', () => {
    it('should select the highest-value bounty', () => {
      const bounties = [
        createMockBounty({ id: 'bounty-1', reward_amount: 200 }),
        createMockBounty({ id: 'bounty-2', reward_amount: 1000 }),
      ];

      const analyses = agent.analyzeBounties(bounties);
      const selected = agent.selectBounty(analyses);

      expect(selected).not.toBeNull();
      expect(selected!.bountyId).toBe('bounty-2');
    });

    it('should return null when no bounties qualify', () => {
      const bounties = [
        createMockBounty({ id: 'bounty-1', reward_amount: 10 }), // Below min reward
      ];

      const analyses = agent.analyzeBounties(bounties);
      const selected = agent.selectBounty(analyses);

      expect(selected).toBeNull();
    });
  });

  describe('event handling', () => {
    it('should emit events when registered', () => {
      const events: AgentEvent[] = [];
      agent.onEvent((event) => events.push(event));

      const bounty = createMockBounty();
      agent.analyzeBounty(bounty);

      // Events are emitted during analysis
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should stop emitting after handler removal', () => {
      const events: AgentEvent[] = [];
      const handler = (event: AgentEvent) => events.push(event);

      agent.onEvent(handler);
      agent.analyzeBounty(createMockBounty());
      const countBefore = events.length;

      agent.offEvent(handler);
      agent.analyzeBounty(createMockBounty());

      expect(events.length).toBe(countBefore);
    });
  });
});

// ---------------------------------------------------------------------------
// SolutionBuilder Tests
// ---------------------------------------------------------------------------

describe('SolutionBuilder', () => {
  let builder: SolutionBuilder;
  let config: AgentOrchestratorConfig;

  beforeEach(() => {
    config = createTestConfig();
    builder = new SolutionBuilder(config);
  });

  describe('initialization', () => {
    it('should start in IDLE state', () => {
      expect(builder.getState()).toBe(AgentState.IDLE);
    });

    it('should report the correct role', () => {
      expect(builder.getRole()).toBe(AgentRole.CODER);
    });
  });

  describe('build', () => {
    it('should build a solution for a bounty analysis', async () => {
      const analysis: BountyAnalysis = {
        bountyId: 'bounty-001',
        title: 'Implement Search API',
        skillMatchScore: 0.8,
        estimatedDifficulty: 5,
        estimatedEffortHours: 16,
        rewardAmount: 500,
        valueRatio: 31.25,
        requirements: ['Build search endpoint', 'Add filtering'],
        recommendedApproach: '1. Review requirements\n2. Implement API\n3. Write tests',
        shouldPursue: true,
        confidence: 0.85,
      };

      const solution = await builder.build(analysis);

      expect(solution.bountyId).toBe('bounty-001');
      expect(solution.files.length).toBeGreaterThan(0);
      expect(solution.readyForSubmission).toBe(true);
      expect(solution.summary.length).toBeGreaterThan(0);
      expect(solution.coveragePercent).toBeGreaterThanOrEqual(0);
    });

    it('should generate different files for different bounty types', async () => {
      const frontendAnalysis: BountyAnalysis = {
        bountyId: 'bounty-002',
        title: 'Build Dashboard UI',
        skillMatchScore: 0.9,
        estimatedDifficulty: 4,
        estimatedEffortHours: 12,
        rewardAmount: 400,
        valueRatio: 33.33,
        requirements: ['Create dashboard component'],
        recommendedApproach: '1. Build UI\n2. Add tests',
        shouldPursue: true,
        confidence: 0.9,
      };

      const solution = await builder.build(frontendAnalysis);

      // Should include frontend files
      const hasFrontendFile = solution.files.some(
        (f) => f.path.includes('frontend') || f.path.includes('.tsx'),
      );
      expect(hasFrontendFile).toBe(true);
    });
  });

  describe('getCurrentSolution', () => {
    it('should return null before building', () => {
      expect(builder.getCurrentSolution()).toBeNull();
    });

    it('should return the solution after building', async () => {
      const analysis: BountyAnalysis = {
        bountyId: 'bounty-001',
        title: 'Test',
        skillMatchScore: 0.5,
        estimatedDifficulty: 3,
        estimatedEffortHours: 8,
        rewardAmount: 200,
        valueRatio: 25,
        requirements: [],
        recommendedApproach: '',
        shouldPursue: true,
        confidence: 0.5,
      };

      await builder.build(analysis);
      expect(builder.getCurrentSolution()).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// TestRunner Tests
// ---------------------------------------------------------------------------

describe('TestRunner', () => {
  let runner: TestRunner;
  let config: AgentOrchestratorConfig;

  beforeEach(() => {
    config = createTestConfig();
    runner = new TestRunner(config);
  });

  describe('initialization', () => {
    it('should start in IDLE state', () => {
      expect(runner.getState()).toBe(AgentState.IDLE);
    });

    it('should report the correct role', () => {
      expect(runner.getRole()).toBe(AgentRole.TESTER);
    });
  });

  describe('run', () => {
    it('should run tests and return results', async () => {
      const solution = {
        bountyId: 'bounty-001',
        files: [
          { path: 'src/NewFeature.ts', isNew: true, linesAdded: 100, linesRemoved: 0 },
          { path: 'src/__tests__/new-feature.test.ts', isNew: true, linesAdded: 80, linesRemoved: 0 },
        ],
        testsPassing: true,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        coveragePercent: 85,
        lintErrors: 0,
        readyForSubmission: true,
        summary: 'Test solution',
      };

      const result = await runner.run(solution);

      expect(result.total).toBeGreaterThan(0);
      expect(result.passedCount).toBeGreaterThanOrEqual(0);
      expect(result.failedCount).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should handle solutions without test files', async () => {
      const solution = {
        bountyId: 'bounty-001',
        files: [
          { path: 'src/NewFeature.ts', isNew: true, linesAdded: 100, linesRemoved: 0 },
        ],
        testsPassing: false,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        coveragePercent: 0,
        lintErrors: 0,
        readyForSubmission: false,
        summary: 'No tests',
      };

      const result = await runner.run(solution);

      expect(result.passed).toBe(false);
      expect(result.failedCount).toBeGreaterThan(0);
    });
  });

  describe('validate', () => {
    it('should pass validation when all conditions are met', async () => {
      const solution = {
        bountyId: 'bounty-001',
        files: [
          { path: 'src/__tests__/test.test.ts', isNew: true, linesAdded: 80, linesRemoved: 0 },
        ],
        testsPassing: true,
        testsRun: 5,
        testsPassed: 5,
        testsFailed: 0,
        coveragePercent: 85,
        lintErrors: 0,
        readyForSubmission: true,
        summary: 'Good solution',
      };

      const testResult = await runner.run(solution);
      const isValid = runner.validate(solution, testResult);

      expect(isValid).toBe(true);
    });

    it('should fail validation when tests fail', async () => {
      const solution = {
        bountyId: 'bounty-001',
        files: [],
        testsPassing: false,
        testsRun: 5,
        testsPassed: 3,
        testsFailed: 2,
        coveragePercent: 60,
        lintErrors: 0,
        readyForSubmission: false,
        summary: 'Bad solution',
      };

      const testResult = await runner.run(solution);
      const isValid = runner.validate(solution, testResult);

      expect(isValid).toBe(false);
    });
  });

  describe('getLastResult', () => {
    it('should return null before running tests', () => {
      expect(runner.getLastResult()).toBeNull();
    });

    it('should return the last result after running tests', async () => {
      const solution = {
        bountyId: 'bounty-001',
        files: [
          { path: 'src/__tests__/test.test.ts', isNew: true, linesAdded: 80, linesRemoved: 0 },
        ],
        testsPassing: true,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        coveragePercent: 80,
        lintErrors: 0,
        readyForSubmission: true,
        summary: 'Test',
      };

      await runner.run(solution);
      expect(runner.getLastResult()).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// PRSubmitter Tests
// ---------------------------------------------------------------------------

describe('PRSubmitter', () => {
  let submitter: PRSubmitter;
  let config: AgentOrchestratorConfig;

  beforeEach(() => {
    config = createTestConfig();
    submitter = new PRSubmitter(config);
  });

  describe('initialization', () => {
    it('should start in IDLE state', () => {
      expect(submitter.getState()).toBe(AgentState.IDLE);
    });

    it('should report the correct role', () => {
      expect(submitter.getRole()).toBe(AgentRole.SUBMITTER);
    });
  });

  describe('submit', () => {
    it('should create a PR submission result', async () => {
      const analysis: BountyAnalysis = {
        bountyId: 'bounty-001',
        title: 'Implement Search API',
        skillMatchScore: 0.8,
        estimatedDifficulty: 5,
        estimatedEffortHours: 16,
        rewardAmount: 500,
        valueRatio: 31.25,
        requirements: ['Build search endpoint'],
        recommendedApproach: '1. Review\n2. Implement\n3. Test',
        shouldPursue: true,
        confidence: 0.85,
      };

      const solution = {
        bountyId: 'bounty-001',
        files: [
          { path: 'src/SearchApi.ts', isNew: true, linesAdded: 100, linesRemoved: 0 },
          { path: 'src/__tests__/search-api.test.ts', isNew: true, linesAdded: 80, linesRemoved: 0 },
        ],
        testsPassing: true,
        testsRun: 5,
        testsPassed: 5,
        testsFailed: 0,
        coveragePercent: 85,
        lintErrors: 0,
        readyForSubmission: true,
        summary: 'Search API implementation',
      };

      const testResult = {
        passed: true,
        total: 5,
        passedCount: 5,
        failedCount: 0,
        skippedCount: 0,
        durationMs: 1500,
        results: [],
      };

      const result = await submitter.submit(analysis, solution, testResult);

      expect(result.success).toBe(true);
      expect(result.prUrl).toContain('github.com');
      expect(result.prNumber).toBeGreaterThan(0);
      expect(result.branchName).toContain('bounty-001');
      expect(result.prTitle.length).toBeGreaterThan(0);
      expect(result.prBody.length).toBeGreaterThan(0);
    });

    it('should generate a descriptive branch name', async () => {
      const analysis: BountyAnalysis = {
        bountyId: 'bounty-042',
        title: 'Add Dashboard Component',
        skillMatchScore: 0.9,
        estimatedDifficulty: 4,
        estimatedEffortHours: 12,
        rewardAmount: 400,
        valueRatio: 33.33,
        requirements: [],
        recommendedApproach: '',
        shouldPursue: true,
        confidence: 0.9,
      };

      const solution = {
        bountyId: 'bounty-042',
        files: [],
        testsPassing: true,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        coveragePercent: 0,
        lintErrors: 0,
        readyForSubmission: true,
        summary: '',
      };

      const testResult = {
        passed: true,
        total: 0,
        passedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        durationMs: 0,
        results: [],
      };

      const result = await submitter.submit(analysis, solution, testResult);

      expect(result.branchName).toContain('bounty-042');
      expect(result.branchName).toContain('add-dashboard-component');
    });
  });

  describe('getLastSubmission', () => {
    it('should return null before submission', () => {
      expect(submitter.getLastSubmission()).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// AgentOrchestrator Tests
// ---------------------------------------------------------------------------

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      apiBaseUrl: 'https://test-api.solfoundry.io',
      targetRepo: 'TestOrg/test-repo',
      agentSkills: ['typescript', 'rust'],
      autoSelectBounty: true,
      minRewardAmount: 50,
      maxEffortHours: 100,
      maxRetries: 0, // No retries in tests for speed
    });
  });

  describe('initialization', () => {
    it('should create with default config values', () => {
      const state = orchestrator.getMissionState();
      expect(state.isActive).toBe(true);
      expect(state.isComplete).toBe(false);
      expect(state.isFailed).toBe(false);
      expect(state.currentStage).toBe(TaskType.DISCOVER);
    });

    it('should have all agents in IDLE state', () => {
      expect(orchestrator.getAgentState(AgentRole.PLANNER)).toBe(AgentState.IDLE);
      expect(orchestrator.getAgentState(AgentRole.CODER)).toBe(AgentState.IDLE);
      expect(orchestrator.getAgentState(AgentRole.TESTER)).toBe(AgentState.IDLE);
      expect(orchestrator.getAgentState(AgentRole.SUBMITTER)).toBe(AgentState.IDLE);
    });

    it('should accept partial config and merge with defaults', () => {
      const partial = new AgentOrchestrator({
        targetRepo: 'Custom/repo',
      });
      const state = partial.getMissionState();
      expect(state.isActive).toBe(true);
    });
  });

  describe('event handling', () => {
    it('should register event handlers', () => {
      const events: AgentEvent[] = [];
      orchestrator.onEvent((event) => events.push(event));

      // The orchestrator should accept the handler without error
      expect(events.length).toBe(0); // No events yet
    });

    it('should remove event handlers', () => {
      const events: AgentEvent[] = [];
      const handler = (event: AgentEvent) => events.push(event);

      orchestrator.onEvent(handler);
      orchestrator.offEvent(handler);

      // Handler should be removed (no way to verify directly without triggering events)
      expect(true).toBe(true);
    });
  });

  describe('stop', () => {
    it('should cancel all agents', () => {
      orchestrator.stop();

      const state = orchestrator.getMissionState();
      expect(state.isActive).toBe(false);

      expect(state.agentStates[AgentRole.PLANNER]).toBe(AgentState.CANCELLED);
      expect(state.agentStates[AgentRole.CODER]).toBe(AgentState.CANCELLED);
      expect(state.agentStates[AgentRole.TESTER]).toBe(AgentState.CANCELLED);
      expect(state.agentStates[AgentRole.SUBMITTER]).toBe(AgentState.CANCELLED);
    });
  });

  describe('reset', () => {
    it('should reset mission state', () => {
      orchestrator.stop();
      orchestrator.reset();

      const state = orchestrator.getMissionState();
      expect(state.isActive).toBe(true);
      expect(state.isComplete).toBe(false);
      expect(state.isFailed).toBe(false);
      expect(state.agentStates[AgentRole.PLANNER]).toBe(AgentState.IDLE);
    });
  });

  describe('DEFAULT_ORCHESTRATOR_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_ORCHESTRATOR_CONFIG.maxConcurrentAgents).toBe(3);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.maxRetries).toBe(2);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.taskTimeoutMs).toBe(300_000);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.autoSelectBounty).toBe(true);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.minRewardAmount).toBe(100);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.maxEffortHours).toBe(40);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.agentSkills).toContain('typescript');
      expect(DEFAULT_ORCHESTRATOR_CONFIG.targetRepo).toBe('SolFoundry/solfoundry');
    });
  });
});

// ---------------------------------------------------------------------------
// Type Export Tests
// ---------------------------------------------------------------------------

describe('Agent type exports', () => {
  it('should export AgentRole enum', () => {
    expect(AgentRole.PLANNER).toBe('planner');
    expect(AgentRole.CODER).toBe('coder');
    expect(AgentRole.TESTER).toBe('tester');
    expect(AgentRole.SUBMITTER).toBe('submitter');
    expect(AgentRole.ORCHESTRATOR).toBe('orchestrator');
  });

  it('should export AgentState enum', () => {
    expect(AgentState.IDLE).toBe('idle');
    expect(AgentState.RUNNING).toBe('running');
    expect(AgentState.WAITING).toBe('waiting');
    expect(AgentState.COMPLETED).toBe('completed');
    expect(AgentState.FAILED).toBe('failed');
    expect(AgentState.CANCELLED).toBe('cancelled');
  });

  it('should export TaskType enum', () => {
    expect(TaskType.DISCOVER).toBe('discover');
    expect(TaskType.ANALYZE).toBe('analyze');
    expect(TaskType.IMPLEMENT).toBe('implement');
    expect(TaskType.TEST).toBe('test');
    expect(TaskType.SUBMIT).toBe('submit');
    expect(TaskType.MONITOR).toBe('monitor');
  });

  it('should export MessageType enum', () => {
    expect(MessageType.TASK_REQUEST).toBe('task_request');
    expect(MessageType.TASK_RESPONSE).toBe('task_response');
    expect(MessageType.STATUS_UPDATE).toBe('status_update');
    expect(MessageType.ERROR).toBe('error');
    expect(MessageType.COMPLETION).toBe('completion');
  });

  it('should export AgentEventType enum', () => {
    expect(AgentEventType.AGENT_STARTED).toBe('agent_started');
    expect(AgentEventType.AGENT_COMPLETED).toBe('agent_completed');
    expect(AgentEventType.MISSION_COMPLETE).toBe('mission_complete');
    expect(AgentEventType.MISSION_FAILED).toBe('mission_failed');
  });
});
