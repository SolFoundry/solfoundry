/**
 * AgentOrchestrator — Multi-agent coordination for autonomous bounty hunting.
 *
 * Orchestrates the full bounty-hunting pipeline: planner → coder → tester →
 * submitter. Manages agent lifecycle, handles inter-agent communication,
 * and provides real-time status monitoring.
 *
 * @module agents/AgentOrchestrator
 */

import type {
  AgentEvent,
  AgentMessage,
  AgentOrchestratorConfig,
  MissionState,
  MutableMissionState,
  BountyAnalysis,
  SolutionResult,
  TestResult,
  PRSubmissionResult,
} from './types.js';
import {
  MessageType,
  AgentEventType,
  TaskType,
  AgentRole,
  AgentState,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './types.js';
import { BountyHunterAgent } from './BountyHunterAgent.js';
import { SolutionBuilder } from './SolutionBuilder.js';
import { TestRunner } from './TestRunner.js';
import { PRSubmitter } from './PRSubmitter.js';

/** Event handler callback for orchestrator events. */
export type OrchestratorEventHandler = (event: AgentEvent) => void;

/**
 * Multi-agent orchestrator for autonomous bounty hunting.
 *
 * Coordinates four specialized agents:
 * - **Planner** (BountyHunterAgent): Discovers and analyzes bounties
 * - **Coder** (SolutionBuilder): Implements solutions
 * - **Tester** (TestRunner): Validates solutions with tests
 * - **Submitter** (PRSubmitter): Creates and submits PRs
 *
 * The orchestrator manages the pipeline flow, handles failures with
 * retry logic, and provides real-time status updates.
 *
 * @example
 * ```typescript
 * const orchestrator = new AgentOrchestrator({
 *   apiBaseUrl: 'https://api.solfoundry.io',
 *   authToken: 'your-jwt',
 *   targetRepo: 'SolFoundry/solfoundry',
 *   agentSkills: ['typescript', 'rust'],
 * });
 *
 * // Listen for events
 * orchestrator.onEvent((event) => {
 *   console.log(`${event.agent}: ${event.message}`);
 * });
 *
 * // Run the full pipeline
 * const result = await orchestrator.run();
 * ```
 */
export class AgentOrchestrator {
  private readonly config: AgentOrchestratorConfig;
  private readonly planner: BountyHunterAgent;
  private readonly coder: SolutionBuilder;
  private readonly tester: TestRunner;
  private readonly submitter: PRSubmitter;
  private eventHandlers: OrchestratorEventHandler[] = [];
  private missionState: MutableMissionState;

  /**
   * Create a new AgentOrchestrator.
   *
   * @param config - Partial or full orchestrator configuration.
   *   Missing values are filled with defaults.
   */
  constructor(config: Partial<AgentOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };

    // Initialize agents with the shared config
    this.planner = new BountyHunterAgent(this.config);
    this.coder = new SolutionBuilder(this.config);
    this.tester = new TestRunner(this.config);
    this.submitter = new PRSubmitter(this.config);

    // Initialize mission state
    this.missionState = this.createMissionState();

    // Wire up agent events to the orchestrator
    this.wireAgentEvents();
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Get the current mission state. */
  getMissionState(): MissionState {
    return { ...this.missionState };
  }

  /** Get the state of a specific agent. */
  getAgentState(role: AgentRole): AgentState {
    return this.missionState.agentStates[role];
  }

  /** Register an event handler for orchestrator events. */
  onEvent(handler: OrchestratorEventHandler): void {
    this.eventHandlers.push(handler);
    // Also register with all agents
    this.planner.onEvent(handler);
    this.coder.onEvent(handler);
    this.tester.onEvent(handler);
    this.submitter.onEvent(handler);
  }

  /** Remove an event handler. */
  offEvent(handler: OrchestratorEventHandler): void {
    this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    this.planner.offEvent(handler);
    this.coder.offEvent(handler);
    this.tester.offEvent(handler);
    this.submitter.offEvent(handler);
  }

  /** Emit an orchestrator-level event. */
  private emit(type: AgentEventType, message: string, data?: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      agent: AgentRole.ORCHESTRATOR,
      message,
      data,
    };
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Silently ignore handler errors
      }
    }
  }

  /** Wire agent events to update mission state. */
  private wireAgentEvents(): void {
    const updateState = (event: AgentEvent) => {
      // Update agent state based on event type
      switch (event.type) {
        case AgentEventType.AGENT_STARTED:
          this.missionState.agentStates[event.agent] = AgentState.RUNNING;
          break;
        case AgentEventType.AGENT_COMPLETED:
          this.missionState.agentStates[event.agent] = AgentState.COMPLETED;
          break;
        case AgentEventType.AGENT_ERROR:
          this.missionState.agentStates[event.agent] = AgentState.FAILED;
          break;
      }
      this.missionState.updatedAt = event.timestamp;
    };

    this.planner.onEvent(updateState);
    this.coder.onEvent(updateState);
    this.tester.onEvent(updateState);
    this.submitter.onEvent(updateState);
  }

  // -----------------------------------------------------------------------
  // Pipeline Execution
  // -----------------------------------------------------------------------

  /**
   * Run the full bounty-hunting pipeline.
   *
   * Executes the pipeline stages in sequence:
   * 1. **Discover & Analyze** — Find and evaluate open bounties
   * 2. **Implement** — Build a solution for the selected bounty
   * 3. **Test** — Run tests and validate quality
   * 4. **Submit** — Create and submit a pull request
   *
   * @returns The final mission state with results.
   */
  async run(): Promise<MissionState> {
    this.emit(AgentEventType.AGENT_STARTED, 'Starting bounty-hunting pipeline');

    try {
      // Stage 1: Discover and analyze bounties
      this.missionState.currentStage = TaskType.DISCOVER;
      this.emit(AgentEventType.STATUS_UPDATE, 'Stage 1: Discovering bounties');

      const plannerResult = await this.executeWithRetry(
        () => this.planner.execute(),
        AgentRole.PLANNER,
      );

      if (plannerResult.type === MessageType.ERROR) {
        return this.failMission(plannerResult.error ?? 'Planner failed');
      }

      // Extract analysis results
      const selectedBounty = plannerResult.payload.selectedBounty as BountyAnalysis | null;
      if (!selectedBounty) {
        return this.failMission('No suitable bounty found');
      }

      this.missionState.bountyId = selectedBounty.bountyId;
      this.missionState.stageResults[TaskType.DISCOVER] = plannerResult.payload;

      this.emit(AgentEventType.BOUNTY_SELECTED, `Selected bounty: ${selectedBounty.title}`, {
        bountyId: selectedBounty.bountyId,
        valueRatio: selectedBounty.valueRatio,
      });

      // Stage 2: Implement solution
      this.missionState.currentStage = TaskType.IMPLEMENT;
      this.emit(AgentEventType.STATUS_UPDATE, 'Stage 2: Building solution');

      const solution = await this.executeWithRetry(
        () => this.coder.build(selectedBounty),
        AgentRole.CODER,
      );

      this.missionState.stageResults[TaskType.IMPLEMENT] = solution as unknown as Record<string, unknown>;

      // Stage 3: Test solution
      this.missionState.currentStage = TaskType.TEST;
      this.emit(AgentEventType.STATUS_UPDATE, 'Stage 3: Running tests');

      const testResult = await this.executeWithRetry(
        () => this.tester.run(solution as SolutionResult),
        AgentRole.TESTER,
      );

      this.missionState.stageResults[TaskType.TEST] = testResult as unknown as Record<string, unknown>;

      // Validate quality gates
      const validationPassed = this.tester.validate(
        solution as SolutionResult,
        testResult as TestResult,
      );

      if (!validationPassed) {
        return this.failMission('Quality gates failed: tests or coverage below threshold');
      }

      // Stage 4: Submit PR
      this.missionState.currentStage = TaskType.SUBMIT;
      this.emit(AgentEventType.STATUS_UPDATE, 'Stage 4: Submitting PR');

      const prResult = await this.executeWithRetry(
        () =>
          this.submitter.submit(
            selectedBounty,
            solution as SolutionResult,
            testResult as TestResult,
          ),
        AgentRole.SUBMITTER,
      );

      this.missionState.stageResults[TaskType.SUBMIT] = prResult as unknown as Record<string, unknown>;

      // Mission complete
      this.missionState.isComplete = true;
      this.missionState.isActive = false;
      this.missionState.completedAt = new Date().toISOString();
      this.missionState.currentStage = TaskType.MONITOR;

      this.emit(AgentEventType.MISSION_COMPLETE, 'Mission completed successfully', {
        bountyId: selectedBounty.bountyId,
        prUrl: (prResult as PRSubmissionResult).prUrl,
      });
    } catch (error) {
      return this.failMission((error as Error).message);
    }

    return this.getMissionState();
  }

  /**
   * Run a single pipeline stage.
   *
   * Useful for step-by-step execution or debugging.
   *
   * @param stage - The stage to execute.
   * @returns The result of the stage execution.
   */
  async runStage(stage: TaskType): Promise<Record<string, unknown>> {
    switch (stage) {
      case TaskType.DISCOVER:
      case TaskType.ANALYZE: {
        const result = await this.planner.execute();
        return result.payload;
      }
      case TaskType.IMPLEMENT: {
        const selected = this.planner.selectBounty();
        if (!selected) throw new Error('No bounty selected for implementation');
        const solution = await this.coder.build(selected);
        return solution as unknown as Record<string, unknown>;
      }
      case TaskType.TEST: {
        const solution = this.coder.getCurrentSolution();
        if (!solution) throw new Error('No solution available for testing');
        const result = await this.tester.run(solution);
        return result as unknown as Record<string, unknown>;
      }
      case TaskType.SUBMIT: {
        const selected = this.planner.selectBounty();
        const solution = this.coder.getCurrentSolution();
        const testResult = this.tester.getLastResult();
        if (!selected || !solution || !testResult) {
          throw new Error('Missing prerequisites for submission');
        }
        const result = await this.submitter.submit(selected, solution, testResult);
        return result as unknown as Record<string, unknown>;
      }
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }
  }

  /**
   * Stop the current mission.
   */
  stop(): void {
    this.missionState.isActive = false;
    this.missionState.agentStates = {
      [AgentRole.PLANNER]: AgentState.CANCELLED,
      [AgentRole.CODER]: AgentState.CANCELLED,
      [AgentRole.TESTER]: AgentState.CANCELLED,
      [AgentRole.SUBMITTER]: AgentState.CANCELLED,
      [AgentRole.ORCHESTRATOR]: AgentState.CANCELLED,
    };
    this.emit(AgentEventType.AGENT_COMPLETED, 'Mission cancelled');
  }

  /**
   * Reset the orchestrator to initial state.
   */
  reset(): void {
    this.missionState = this.createMissionState();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Create a fresh mission state. */
  private createMissionState(): MissionState {
    const now = new Date().toISOString();
    return {
      missionId: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      bountyId: null,
      currentStage: TaskType.DISCOVER,
      agentStates: {
        [AgentRole.PLANNER]: AgentState.IDLE,
        [AgentRole.CODER]: AgentState.IDLE,
        [AgentRole.TESTER]: AgentState.IDLE,
        [AgentRole.SUBMITTER]: AgentState.IDLE,
        [AgentRole.ORCHESTRATOR]: AgentState.IDLE,
      },
      isActive: true,
      isComplete: false,
      isFailed: false,
      createdAt: now,
      updatedAt: now,
      stageResults: {},
    };
  }

  /** Mark the mission as failed. */
  private failMission(errorMessage: string): MissionState {
    this.missionState.isFailed = true;
    this.missionState.isActive = false;
    this.missionState.errorMessage = errorMessage;
    this.missionState.updatedAt = new Date().toISOString();

    this.emit(AgentEventType.MISSION_FAILED, `Mission failed: ${errorMessage}`, {
      error: errorMessage,
    });

    return this.getMissionState();
  }

  /**
   * Execute a function with retry logic.
   *
   * Retries the function up to `maxRetries` times on failure,
   * with exponential backoff between attempts.
   *
   * @param fn - The function to execute.
   * @param role - The agent role executing the function.
   * @returns The result of the function.
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    role: AgentRole,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt), 5000);
          this.emit(AgentEventType.STATUS_UPDATE, `Retrying ${role} (attempt ${attempt + 2})`, {
            delay,
            error: lastError.message,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error(`${role} failed after ${this.config.maxRetries + 1} attempts`);
  }
}
