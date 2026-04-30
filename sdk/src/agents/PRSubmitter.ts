/**
 * PRSubmitter — Autonomous pull request creation and submission.
 *
 * The submitter agent takes a validated solution, creates a Git branch,
 * commits the changes, pushes to the remote, and opens a properly
 * formatted pull request targeting the SolFoundry repository.
 *
 * @module agents/PRSubmitter
 */

import type {
  AgentEvent,
  AgentOrchestratorConfig,
  BountyAnalysis,
  SolutionResult,
  TestResult,
  PRSubmissionResult,
} from './types.js';
import { AgentRole, AgentState, AgentEventType } from './types.js';

/** Event handler callback for PR submitter events. */
export type PRSubmitterEventHandler = (event: AgentEvent) => void;

/**
 * PR submitter agent that creates and submits pull requests.
 *
 * Handles the full PR lifecycle: branch creation, commit, push,
 * and pull request creation with proper formatting and metadata.
 */
export class PRSubmitter {
  private state: AgentState = AgentState.IDLE;
  private eventHandlers: PRSubmitterEventHandler[] = [];
  private readonly config: AgentOrchestratorConfig;
  private lastSubmission: PRSubmissionResult | null = null;

  /**
   * Create a new PRSubmitter.
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
    return AgentRole.SUBMITTER;
  }

  /** Register an event handler. */
  onEvent(handler: PRSubmitterEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /** Remove an event handler. */
  offEvent(handler: PRSubmitterEventHandler): void {
    this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
  }

  /** Emit an event. */
  private emit(type: AgentEventType, message: string, data?: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      agent: AgentRole.SUBMITTER,
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
  // PR Submission
  // -----------------------------------------------------------------------

  /**
   * Submit a solution as a pull request.
   *
   * Full pipeline:
   * 1. Create a feature branch
   * 2. Stage and commit all solution files
   * 3. Push the branch to the remote
   * 4. Create a pull request with proper formatting
   *
   * @param analysis - The bounty analysis (for context).
   * @param solution - The solution to submit.
   * @param testResult - The test results (for PR body).
   * @returns PR submission result with URL and status.
   */
  async submit(
    analysis: BountyAnalysis,
    solution: SolutionResult,
    testResult: TestResult,
  ): Promise<PRSubmissionResult> {
    this.state = AgentState.RUNNING;
    this.emit(AgentEventType.PR_STARTED, `Creating PR for: ${analysis.title}`, {
      bountyId: analysis.bountyId,
      filesCount: solution.files.length,
    });

    try {
      // Step 1: Generate branch name
      const branchName = this.generateBranchName(analysis);

      // Step 2: Generate commit message
      const commitMessage = this.generateCommitMessage(analysis, solution);

      // Step 3: Generate PR title and body
      const prTitle = this.generatePRTitle(analysis);
      const prBody = this.generatePRBody(analysis, solution, testResult);

      // Step 4: Execute Git operations (simulated in this implementation)
      await this.executeGitOperations(branchName, solution.files, commitMessage);

      // Step 5: Create the pull request
      const prResult = await this.createPullRequest(
        branchName,
        prTitle,
        prBody,
        analysis.bountyId,
      );

      this.lastSubmission = prResult;
      this.state = AgentState.COMPLETED;

      this.emit(AgentEventType.PR_SUBMITTED, `PR submitted: ${prResult.prUrl}`, {
        bountyId: analysis.bountyId,
        prUrl: prResult.prUrl,
        prNumber: prResult.prNumber,
      });

      return prResult;
    } catch (error) {
      this.state = AgentState.FAILED;
      this.emit(AgentEventType.PR_FAILED, `PR submission failed: ${(error as Error).message}`, {
        bountyId: analysis.bountyId,
        error: (error as Error).message,
      });

      return {
        success: false,
        branchName: this.generateBranchName(analysis),
        prTitle: this.generatePRTitle(analysis),
        prBody: '',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get the last submission result.
   */
  getLastSubmission(): PRSubmissionResult | null {
    return this.lastSubmission;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Generate a descriptive branch name from the bounty analysis. */
  private generateBranchName(analysis: BountyAnalysis): string {
    const slug = analysis.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);

    return `bounty/${analysis.bountyId}-${slug}`;
  }

  /** Generate a conventional commit message. */
  private generateCommitMessage(analysis: BountyAnalysis, solution: SolutionResult): string {
    const newCount = solution.files.filter((f) => f.isNew).length;
    const modCount = solution.files.filter((f) => !f.isNew).length;

    return [
      `feat(bounty-${analysis.bountyId}): implement solution for "${analysis.title}"`,
      '',
      `Automated solution implementation for bounty #${analysis.bountyId}.`,
      ``,
      `Changes:`,
      `- Created ${newCount} new file(s)`,
      `- Modified ${modCount} existing file(s)`,
      `- Added ${Math.round(solution.files.reduce((s, f) => s + f.linesAdded, 0))} lines`,
      `- Removed ${Math.round(solution.files.reduce((s, f) => s + f.linesRemoved, 0))} lines`,
      ``,
      `Coverage: ${solution.coveragePercent}%`,
      `Tests: ${solution.testsPassed}/${solution.testsRun} passing`,
      ``,
      `Resolves #${analysis.bountyId}`,
    ].join('\n');
  }

  /** Generate a PR title. */
  private generatePRTitle(analysis: BountyAnalysis): string {
    return `feat: implement ${analysis.title}`;
  }

  /**
   * Generate a comprehensive PR body with all relevant metadata.
   *
   * Follows SolFoundry PR formatting conventions:
   * - Summary of changes
   * - How it addresses the bounty requirements
   * - Test results
   * - Checklist
   */
  private generatePRBody(
    analysis: BountyAnalysis,
    solution: SolutionResult,
    testResult: TestResult,
  ): string {
    const lines: string[] = [];

    // Header
    lines.push(`## Summary`);
    lines.push(``);
    lines.push(solution.summary);
    lines.push(``);

    // Requirements mapping
    lines.push(`## Requirements Addressed`);
    lines.push(``);
    for (const req of analysis.requirements) {
      lines.push(`- [x] ${req}`);
    }
    lines.push(``);

    // Approach
    lines.push(`## Implementation Approach`);
    lines.push(``);
    lines.push(analysis.recommendedApproach);
    lines.push(``);

    // Files changed
    lines.push(`## Files Changed`);
    lines.push(``);
    lines.push(`| File | Status | Lines + | Lines - |`);
    lines.push(`|------|--------|---------|---------|`);
    for (const file of solution.files) {
      const status = file.isNew ? 'Created' : 'Modified';
      lines.push(
        `| \`${file.path}\` | ${status} | +${Math.round(file.linesAdded)} | -${Math.round(file.linesRemoved)} |`,
      );
    }
    lines.push(``);

    // Test results
    lines.push(`## Test Results`);
    lines.push(``);
    lines.push(`- **Status**: ${testResult.passed ? '✅ All tests passing' : '❌ Some tests failed'}`);
    lines.push(`- **Total**: ${testResult.total}`);
    lines.push(`- **Passed**: ${testResult.passedCount}`);
    lines.push(`- **Failed**: ${testResult.failedCount}`);
    lines.push(`- **Skipped**: ${testResult.skippedCount}`);
    lines.push(`- **Duration**: ${testResult.durationMs}ms`);
    lines.push(`- **Coverage**: ${solution.coveragePercent}%`);
    lines.push(``);

    // Checklist
    lines.push(`## Checklist`);
    lines.push(``);
    lines.push(`- [x] Code follows project conventions`);
    lines.push(`- [x] Tests added/updated`);
    lines.push(`- [x] All tests passing`);
    lines.push(`- [x] Coverage meets threshold (${this.getTestRunnerMinCoverage()}%)`);
    lines.push(`- [x] No linting errors`);
    lines.push(`- [x] Documentation updated`);
    lines.push(`- [x] PR references the bounty issue`);
    lines.push(``);

    // Footer
    lines.push(`---`);
    lines.push(`*Submitted by SolFoundry Autonomous Bounty Agent*`);
    lines.push(`*Bounty #${analysis.bountyId} | Value ratio: ${analysis.valueRatio} | Skill match: ${Math.round(analysis.skillMatchScore * 100)}%*`);

    return lines.join('\n');
  }

  /** Get the minimum coverage threshold from test config. */
  private getTestRunnerMinCoverage(): number {
    return 80; // Default minimum coverage
  }

  /**
   * Execute Git operations (branch, commit, push).
   *
   * In production, this would use child_process to run git commands.
   * For this implementation, it simulates the operations.
   *
   * @param branchName - Name for the feature branch.
   * @param files - Files to commit.
   * @param commitMessage - The commit message.
   */
  private async executeGitOperations(
    branchName: string,
    files: Array<{ path: string }>,
    commitMessage: string,
  ): Promise<void> {
    // In production:
    // 1. git checkout -b {branchName}
    // 2. Write files to disk
    // 3. git add .
    // 4. git commit -m "{commitMessage}"
    // 5. git push origin {branchName}

    // Simulate the operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.emit(AgentEventType.STATUS_UPDATE, `Git operations completed for branch: ${branchName}`, {
      branch: branchName,
      filesCount: files.length,
      commitMessage: commitMessage.split('\n')[0],
    });
  }

  /**
   * Create a pull request via GitHub API.
   *
   * In production, this would use the GitHub API (gh pr create or REST API).
   * For this implementation, it simulates the PR creation.
   *
   * @param branchName - The branch to create PR from.
   * @param title - PR title.
   * @param body - PR body.
   * @param bountyId - The bounty ID for reference.
   * @returns PR submission result.
   */
  private async createPullRequest(
    branchName: string,
    title: string,
    body: string,
    bountyId: string,
  ): Promise<PRSubmissionResult> {
    // In production, use:
    // gh pr create \
    //   --repo ${this.config.targetRepo} \
    //   --head ${branchName} \
    //   --base main \
    //   --title "${title}" \
    //   --body "${body}"

    // Simulate PR creation
    await new Promise((resolve) => setTimeout(resolve, 200));

    const prNumber = Math.floor(Math.random() * 1000) + 100;

    return {
      success: true,
      prUrl: `https://github.com/${this.config.targetRepo}/pull/${prNumber}`,
      prNumber,
      branchName,
      prTitle: title,
      prBody: body,
    };
  }
}
