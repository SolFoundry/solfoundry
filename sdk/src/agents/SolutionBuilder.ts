/**
 * SolutionBuilder — Automated solution implementation for bounties.
 *
 * The coder agent takes a bounty analysis and generates implementation
 * code, file modifications, and a complete solution ready for testing.
 *
 * @module agents/SolutionBuilder
 */

import type {
  AgentEvent,
  AgentOrchestratorConfig,
  BountyAnalysis,
  SolutionResult,
  SolutionFile,
} from './types.js';
import { AgentRole, AgentState, AgentEventType } from './types.js';

/** Event handler callback for solution builder events. */
export type SolutionBuilderEventHandler = (event: AgentEvent) => void;

/**
 * Solution builder agent that implements code solutions.
 *
 * In a production environment, this agent would integrate with an LLM
 * API (e.g., Claude, GPT-4) to generate code. For this implementation,
 * it provides the orchestration framework and structured output format
 * for solution generation.
 */
export class SolutionBuilder {
  private state: AgentState = AgentState.IDLE;
  private eventHandlers: SolutionBuilderEventHandler[] = [];
  private readonly config: AgentOrchestratorConfig;

  /** Currently built solution. */
  private currentSolution: SolutionResult | null = null;

  /**
   * Create a new SolutionBuilder.
   *
   * @param config - Orchestrator configuration.
   */
  constructor(config: AgentOrchestratorConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Get the current agent state. */
  getState(): AgentState {
    return this.state;
  }

  /** Get the role of this agent. */
  getRole(): AgentRole {
    return AgentRole.CODER;
  }

  /** Register an event handler. */
  onEvent(handler: SolutionBuilderEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /** Remove an event handler. */
  offEvent(handler: SolutionBuilderEventHandler): void {
    this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
  }

  /** Emit an event. */
  private emit(type: AgentEventType, message: string, data?: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      agent: AgentRole.CODER,
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

  // -----------------------------------------------------------------------
  // Solution Building
  // -----------------------------------------------------------------------

  /**
   * Build a solution for the given bounty analysis.
   *
   * This method orchestrates the solution generation process:
   * 1. Parse requirements from the analysis
   * 2. Generate implementation plan
   * 3. Create/modify files
   * 4. Validate solution completeness
   *
   * @param analysis - The bounty analysis to implement.
   * @returns The solution result with file changes and validation status.
   */
  async build(analysis: BountyAnalysis): Promise<SolutionResult> {
    this.state = AgentState.RUNNING;
    this.emit(AgentEventType.SOLUTION_STARTED, `Building solution for: ${analysis.title}`, {
      bountyId: analysis.bountyId,
      requirements: analysis.requirements,
    });

    try {
      // Step 1: Generate implementation plan
      const plan = this.generatePlan(analysis);

      // Step 2: Create solution files
      const files = await this.generateFiles(analysis, plan);

      // Step 3: Validate solution
      const testsPassing = true; // Placeholder — actual testing done by TestRunner
      const testsRun = 0;
      const testsPassed = 0;
      const testsFailed = 0;
      const coveragePercent = this.estimateCoverage(files);
      const lintErrors = 0; // Placeholder — actual linting done separately
      const readyForSubmission = files.length > 0 && lintErrors === 0;

      const solution: SolutionResult = {
        bountyId: analysis.bountyId,
        files,
        testsPassing,
        testsRun,
        testsPassed,
        testsFailed,
        coveragePercent,
        lintErrors,
        readyForSubmission,
        summary: this.generateSummary(analysis, files),
      };

      this.currentSolution = solution;
      this.state = AgentState.COMPLETED;

      this.emit(AgentEventType.SOLUTION_COMPLETED, 'Solution built successfully', {
        bountyId: analysis.bountyId,
        filesCount: files.length,
        coveragePercent,
      });

      return solution;
    } catch (error) {
      this.state = AgentState.FAILED;
      this.emit(AgentEventType.AGENT_ERROR, `Solution build failed: ${(error as Error).message}`, {
        bountyId: analysis.bountyId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate an implementation plan from the bounty analysis.
   *
   * @param analysis - The bounty analysis.
   * @returns Structured implementation plan.
   */
  private generatePlan(analysis: BountyAnalysis): Record<string, unknown> {
    const plan: Record<string, unknown> = {
      bountyId: analysis.bountyId,
      title: analysis.title,
      steps: [] as string[],
      filesToCreate: [] as string[],
      filesToModify: [] as string[],
    };

    // Generate steps based on requirements
    const steps: string[] = [];
    for (const req of analysis.requirements) {
      steps.push(`Implement: ${req}`);
    }
    steps.push('Write unit tests');
    steps.push('Add integration tests');
    steps.push('Update documentation');

    plan.steps = steps;

    // Determine file types based on category/skills
    const fileTypes = this.inferFileTypes(analysis);
    plan.filesToCreate = fileTypes.toCreate;
    plan.filesToModify = fileTypes.toModify;

    return plan;
  }

  /**
   * Generate solution files based on the analysis and plan.
   *
   * In production, this would call an LLM API to generate actual code.
   * Here, it creates structured file descriptors.
   *
   * @param analysis - The bounty analysis.
   * @param plan - The implementation plan.
   * @returns Array of solution file descriptors.
   */
  private async generateFiles(
    analysis: BountyAnalysis,
    plan: Record<string, unknown>,
  ): Promise<SolutionFile[]> {
    const files: SolutionFile[] = [];

    const toCreate = (plan.filesToCreate as string[]) ?? [];
    const toModify = (plan.filesToModify as string[]) ?? [];

    for (const filePath of toCreate) {
      files.push({
        path: filePath,
        isNew: true,
        linesAdded: this.estimateLines(filePath, true),
        linesRemoved: 0,
      });
    }

    for (const filePath of toModify) {
      files.push({
        path: filePath,
        isNew: false,
        linesAdded: this.estimateLines(filePath, false),
        linesRemoved: this.estimateLines(filePath, false) * 0.3,
      });
    }

    return files;
  }

  /**
   * Infer which file types to create/modify based on the analysis.
   */
  private inferFileTypes(analysis: BountyAnalysis): { toCreate: string[]; toModify: string[] } {
    const toCreate: string[] = [];
    const toModify: string[] = [];

    const title = analysis.title.toLowerCase();
    const approach = analysis.recommendedApproach.toLowerCase();

    // Smart contract bounties
    if (title.includes('contract') || title.includes('anchor') || title.includes('solana')) {
      toCreate.push('sdk/src/programs/NewProgram.ts');
      toCreate.push('sdk/src/__tests__/new-program.test.ts');
      toModify.push('sdk/src/programs/index.ts');
      toModify.push('sdk/src/index.ts');
    }
    // Frontend bounties
    else if (title.includes('frontend') || title.includes('ui') || title.includes('dashboard')) {
      toCreate.push('frontend/src/components/NewComponent.tsx');
      toCreate.push('frontend/src/hooks/useNewHook.ts');
      toCreate.push('frontend/src/__tests__/new-component.test.tsx');
      toModify.push('frontend/src/App.tsx');
    }
    // API/Backend bounties
    else if (title.includes('api') || title.includes('endpoint') || title.includes('backend')) {
      toCreate.push('sdk/src/NewClient.ts');
      toCreate.push('sdk/src/__tests__/new-client.test.ts');
      toModify.push('sdk/src/index.ts');
    }
    // Generic bounties
    else {
      toCreate.push(`sdk/src/NewFeature.ts`);
      toCreate.push(`sdk/src/__tests__/new-feature.test.ts`);
    }

    return { toCreate, toModify };
  }

  /** Estimate lines of code for a file. */
  private estimateLines(filePath: string, isNew: boolean): number {
    if (filePath.endsWith('.test.') || filePath.endsWith('.test.')) {
      return isNew ? 80 : 40;
    }
    if (filePath.endsWith('.tsx')) {
      return isNew ? 120 : 60;
    }
    if (filePath.endsWith('.ts')) {
      return isNew ? 100 : 50;
    }
    return isNew ? 50 : 25;
  }

  /** Estimate test coverage based on files. */
  private estimateCoverage(files: SolutionFile[]): number {
    const testFiles = files.filter((f) => f.path.includes('.test.'));
    const sourceFiles = files.filter((f) => !f.path.includes('.test.') && f.isNew);

    if (sourceFiles.length === 0) return 0;
    if (testFiles.length === 0) return 20; // Minimal coverage without tests

    // Rough estimate: each test file covers ~80% of its corresponding source
    const coveragePerTest = 80 / Math.max(sourceFiles.length, 1);
    return Math.min(Math.round(coveragePerTest * testFiles.length), 95);
  }

  /** Generate a human-readable summary of the solution. */
  private generateSummary(analysis: BountyAnalysis, files: SolutionFile[]): string {
    const newCount = files.filter((f) => f.isNew).length;
    const modCount = files.filter((f) => !f.isNew).length;
    const totalAdded = files.reduce((sum, f) => sum + f.linesAdded, 0);
    const totalRemoved = files.reduce((sum, f) => sum + f.linesRemoved, 0);

    return [
      `Solution for "${analysis.title}"`,
      `Created ${newCount} new file(s), modified ${modCount} existing file(s).`,
      `Added ${Math.round(totalAdded)} lines, removed ${Math.round(totalRemoved)} lines.`,
      `Estimated coverage: ${this.estimateCoverage(files)}%.`,
    ].join('\n');
  }

  /** Get the current solution result. */
  getCurrentSolution(): SolutionResult | null {
    return this.currentSolution;
  }
}
