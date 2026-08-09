/**
 * Main orchestrator — coordinates the multi-LLM autonomous bounty-hunting
 * pipeline.
 *
 * The orchestrator ties together the scanner, planner, implementer,
 * verifier, reviewer, and submitter agents into a single pipeline:
 *
 * 1. **Scan** — Discover unclaimed bounty issues from GitHub.
 * 2. **Plan** — Analyze requirements and generate an implementation plan.
 * 3. **Implement** — Generate code following the plan.
 * 4. **Verify** — Run tests and validate the solution.
 * 5. **Review** — Multi-LLM review of the solution.
 * 6. **Submit** — Create a pull request on GitHub.
 *
 * @module agent/orchestrator
 */

import { BaseAgent } from './agent.js';
import {
  AgentRole,
  AgentStepStatus,
  type AgentStep,
  type BountyCandidate,
  type BountyHunterConfig,
  type BountyHunterResult,
  type ImplementationPlan,
  type ReviewResult,
  type VerificationResult,
} from './types.js';
import type { GitHubBountyIssue } from '../types.js';
import { GitHubClient } from '../github.js';
import { PlannerAgent } from './planner.js';
import { ImplementerAgent } from './implementer.js';
import { VerifierAgent } from './verifier.js';
import { ReviewerAgent } from './reviewer.js';
import { SubmitterAgent } from './submitter.js';

/**
 * The bounty-hunting orchestrator coordinates the full autonomous
 * pipeline from bounty discovery to PR submission.
 *
 * @example
 * ```typescript
 * const hunter = new BountyHunter({
 *   providers: {},
 *   defaultProvider: { provider: 'openai', apiKey: '...', model: 'gpt-4o' },
 *   github: { owner: 'SolFoundry', repo: 'solfoundry' },
 *   walletAddress: 'fj4WqyCCw3C5ShR1RfB7MoBPTpkRrBFYP1uT35g3MvT',
 * });
 *
 * const result = await hunter.hunt(861);
 * console.log(result.prUrl);
 * ```
 */
export class BountyHunter {
  private readonly config: BountyHunterConfig;
  private readonly github: GitHubClient;
  private readonly agents: Partial<Record<AgentRole, BaseAgent>>;
  private readonly steps: AgentStep[] = [];

  /**
   * Create a new BountyHunter.
   *
   * @param config - Orchestrator configuration.
   */
  constructor(config: BountyHunterConfig) {
    this.config = config;
    this.github = new GitHubClient({
      token: config.github.token,
      owner: config.github.owner,
      repo: config.github.repo,
    });

    this.agents = {
      [AgentRole.PLANNER]: new PlannerAgent(this.getProvider(AgentRole.PLANNER), config.mockMode),
      [AgentRole.IMPLEMENTER]: new ImplementerAgent(
        this.getProvider(AgentRole.IMPLEMENTER),
        config.mockMode,
      ),
      [AgentRole.VERIFIER]: new VerifierAgent(
        this.getProvider(AgentRole.VERIFIER),
        config.mockMode,
      ),
      [AgentRole.REVIEWER]: new ReviewerAgent(
        this.getProvider(AgentRole.REVIEWER),
        config.mockMode,
      ),
      [AgentRole.SUBMITTER]: new SubmitterAgent(
        this.getProvider(AgentRole.SUBMITTER),
        config.mockMode,
      ),
    };
  }

  /**
   * Get the LLM provider for a specific agent role, falling back to
   * the default provider.
   */
  private getProvider(role: AgentRole) {
    return this.config.providers[role] ?? this.config.defaultProvider;
  }

  /**
   * Run the full bounty-hunting pipeline for a specific issue number.
   *
   * @param issueNumber - The GitHub issue number to process.
   * @returns The pipeline result.
   */
  async hunt(issueNumber: number): Promise<BountyHunterResult> {
    const startTime = Date.now();
    let plan: ImplementationPlan | null = null;
    let verification: VerificationResult | null = null;
    let review: ReviewResult | null = null;
    let prUrl: string | null = null;
    let error: string | null = null;

    try {
      // 1. Fetch and analyze the bounty issue
      const issue = await this.analyzeBounty(issueNumber);

      // 2. Plan
      plan = await this.runPlan(issue);

      // 3. Implement
      const implementation = await this.runImplement(issue, plan);

      // 4. Verify
      verification = await this.runVerify(implementation.files);

      // 5. Review
      review = await this.runReview(issue, implementation.files, verification);

      // 6. Submit (only if verified and reviewed)
      if (verification.passed && review.approved) {
        prUrl = await this.runSubmit(issue, implementation.files);
      } else {
        this.addStep(AgentRole.SUBMITTER, 'Submit PR', AgentStepStatus.SKIPPED,
          verification.passed ? 'Review not approved' : 'Verification failed');
      }
    } catch (err) {
      error = String(err);
      this.addStep(AgentRole.SCANNER, 'Pipeline failed', AgentStepStatus.FAILED, error);
    }

    return {
      issue: await this.getIssueSafely(issueNumber),
      success: prUrl !== null,
      steps: this.steps,
      plan,
      verification,
      review,
      prUrl,
      error,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Run the full pipeline for a single issue and return the PR URL.
   * Convenience wrapper around {@link hunt}.
   *
   * @param issueNumber - The GitHub issue number.
   * @returns The PR URL, or null if the pipeline failed.
   */
  async huntAndSubmit(issueNumber: number): Promise<string | null> {
    const result = await this.hunt(issueNumber);
    return result.prUrl;
  }

  /**
   * Scan for unclaimed bounty issues.
   *
   * @param options - Optional filtering options.
   * @returns List of bounty candidates.
   */
  async scan(options?: { limit?: number }): Promise<BountyCandidate[]> {
    this.addStep(AgentRole.SCANNER, 'Scan for unclaimed bounties', AgentStepStatus.RUNNING);
    const startTime = Date.now();

    try {
      const issues = await this.github.listBountyIssues({
        state: 'open',
        labels: 'bounty',
        perPage: options?.limit ?? 20,
      });

      const candidates: BountyCandidate[] = [];
      for (const issue of issues) {
        const [isClaimed, isCompleted] = await Promise.all([
          this.github.isIssueClaimed(issue.number),
          this.github.isIssueCompleted(issue.number),
        ]);

        candidates.push({
          issue,
          complexity: this.estimateComplexity(issue),
          isCodeTask: this.isCodeTask(issue),
          isClaimed,
          isCompleted,
          confidence: this.estimateConfidence(issue),
        });
      }

      this.completeStep(AgentRole.SCANNER, Date.now() - startTime);
      return candidates;
    } catch (err) {
      this.completeStep(AgentRole.SCANNER, Date.now() - startTime, String(err));
      throw err;
    }
  }

  /**
   * Fetch and analyze a specific bounty issue.
   */
  private async analyzeBounty(issueNumber: number): Promise<GitHubBountyIssue> {
    this.addStep(AgentRole.SCANNER, `Analyze bounty #${issueNumber}`, AgentStepStatus.RUNNING);
    const startTime = Date.now();

    try {
      const issue = await this.github.getIssue(issueNumber);
      const claimed = await this.github.isIssueClaimed(issueNumber);

      if (claimed) {
        throw new Error(`Bounty #${issueNumber} has already been claimed by another PR.`);
      }

      this.completeStep(AgentRole.SCANNER, Date.now() - startTime);
      return issue;
    } catch (err) {
      this.completeStep(AgentRole.SCANNER, Date.now() - startTime, String(err));
      throw err;
    }
  }

  /**
   * Run the planning step.
   */
  private async runPlan(issue: GitHubBountyIssue): Promise<ImplementationPlan> {
    this.addStep(AgentRole.PLANNER, 'Generate implementation plan', AgentStepStatus.RUNNING);
    const startTime = Date.now();

    const planner = this.agents[AgentRole.PLANNER] as PlannerAgent;
    const plan = await planner.execute({
      candidate: {
        issue,
        complexity: this.estimateComplexity(issue),
        isCodeTask: this.isCodeTask(issue),
        isClaimed: false,
        isCompleted: false,
        confidence: this.estimateConfidence(issue),
      },
      issue,
    });

    if (!plan) {
      throw new Error('Planner agent returned no plan.');
    }

    this.completeStep(AgentRole.PLANNER, Date.now() - startTime);
    return plan;
  }

  /**
   * Run the implementation step.
   */
  private async runImplement(
    issue: GitHubBountyIssue,
    plan: ImplementationPlan,
  ): Promise<{ files: Array<{ filePath: string; content: string }> }> {
    this.addStep(AgentRole.IMPLEMENTER, 'Implement solution', AgentStepStatus.RUNNING);
    const startTime = Date.now();

    const implementer = this.agents[AgentRole.IMPLEMENTER] as ImplementerAgent;
    const result = await implementer.execute({
      issue,
      plan,
    });

    if (!result.success) {
      throw new Error(`Implementation failed: ${result.error}`);
    }

    this.completeStep(AgentRole.IMPLEMENTER, Date.now() - startTime);
    return { files: result.files };
  }

  /**
   * Run the verification step.
   */
  private async runVerify(
    files: Array<{ filePath: string; content: string }>,
  ): Promise<VerificationResult> {
    this.addStep(AgentRole.VERIFIER, 'Run tests and verify solution', AgentStepStatus.RUNNING);
    const startTime = Date.now();

    const verifier = this.agents[AgentRole.VERIFIER] as VerifierAgent;
    const result = await verifier.execute({
      files,
      projectRoot: process.cwd(),
      runTests: false, // Tests run externally; static analysis is primary
      runTypeCheck: false,
      runLint: false,
    });

    this.completeStep(AgentRole.VERIFIER, Date.now() - startTime);
    return result;
  }

  /**
   * Run the review step.
   */
  private async runReview(
    issue: GitHubBountyIssue,
    files: Array<{ filePath: string; content: string }>,
    verification: VerificationResult,
  ): Promise<ReviewResult> {
    this.addStep(AgentRole.REVIEWER, 'Multi-LLM code review', AgentStepStatus.RUNNING);
    const startTime = Date.now();

    const reviewer = this.agents[AgentRole.REVIEWER] as ReviewerAgent;
    const result = await reviewer.execute({
      issue,
      files,
    });

    this.completeStep(AgentRole.REVIEWER, Date.now() - startTime);
    return result;
  }

  /**
   * Run the submission step.
   */
  private async runSubmit(
    issue: GitHubBountyIssue,
    files: Array<{ filePath: string; content: string }>,
  ): Promise<string> {
    this.addStep(AgentRole.SUBMITTER, `Submit PR for #${issue.number}`, AgentStepStatus.RUNNING);
    const startTime = Date.now();

    const submitter = this.agents[AgentRole.SUBMITTER] as SubmitterAgent;
    const branchName = `feat/bounty-${issue.number}`;
    const title = `feat: implement bounty #${issue.number} (${issue.title})`;
    const body = `Implements bounty #${issue.number}\n\n${issue.body.slice(0, 500)}`;

    const result = await submitter.execute({
      files,
      githubToken: this.config.github.token ?? '',
      config: {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        branchName,
        baseBranch: 'main',
        title,
        body,
        walletAddress: this.config.walletAddress,
      },
    });

    if (!result.success) {
      throw new Error(`PR submission failed: ${result.error}`);
    }

    this.completeStep(AgentRole.SUBMITTER, Date.now() - startTime);
    return result.prUrl ?? '';
  }

  /**
   * Safely get an issue (for the result object even on failure).
   */
  private async getIssueSafely(issueNumber: number): Promise<GitHubBountyIssue> {
    try {
      return await this.github.getIssue(issueNumber);
    } catch {
      return {
        number: issueNumber,
        title: `Issue #${issueNumber}`,
        body: '',
        state: 'open',
        labels: [],
        html_url: '',
        created_at: '',
        updated_at: '',
      };
    }
  }

  /**
   * Add a step to the pipeline log.
   */
  private addStep(
    role: AgentRole,
    description: string,
    status: AgentStepStatus,
    error?: string,
  ): void {
    this.steps.push({
      role,
      description,
      status,
      error,
    });
  }

  /**
   * Mark the most recent step of a role as complete.
   */
  private completeStep(role: AgentRole, durationMs: number, error?: string): void {
    for (let i = this.steps.length - 1; i >= 0; i--) {
      if (this.steps[i].role === role && this.steps[i].status === AgentStepStatus.RUNNING) {
        this.steps[i].status = error ? AgentStepStatus.FAILED : AgentStepStatus.SUCCESS;
        this.steps[i].error = error;
        this.steps[i].durationMs = durationMs;
        return;
      }
    }
  }

  /**
   * Estimate whether a bounty is a code task (vs. community/docs).
   */
  private isCodeTask(issue: GitHubBountyIssue): boolean {
    const labels = issue.labels.join(' ').toLowerCase();
    const body = issue.body.toLowerCase();

    const nonCodeKeywords = ['video', 'blog', 'community', 'star', 'explainer', 'infographic'];
    const codeKeywords = ['api', 'sdk', 'backend', 'frontend', 'implement', 'build', 'fix', 'sdk'];

    if (nonCodeKeywords.some((k) => labels.includes(k) || body.includes(k))) {
      return false;
    }
    return codeKeywords.some((k) => labels.includes(k) || body.includes(k));
  }

  /**
   * Estimate bounty complexity (1-10) based on labels and body.
   */
  private estimateComplexity(issue: GitHubBountyIssue): number {
    const labels = issue.labels.join(' ').toLowerCase();
    const body = issue.body.toLowerCase();

    if (labels.includes('tier-3') || labels.includes('t3')) {
      return 8;
    }
    if (labels.includes('tier-2') || labels.includes('t2')) {
      return 5;
    }
    if (labels.includes('tier-1') || labels.includes('t1')) {
      return 3;
    }

    // Estimate from body length and keywords
    let complexity = 3;
    if (body.length > 1000) complexity += 2;
    if (body.includes('acceptance criteria')) complexity += 1;
    if (body.toLowerCase().includes('test')) complexity += 1;

    return Math.min(10, complexity);
  }

  /**
   * Estimate confidence (0-1) that this is a viable bounty.
   */
  private estimateConfidence(issue: GitHubBountyIssue): number {
    const labels = issue.labels.join(' ').toLowerCase();
    const body = issue.body.toLowerCase();

    let confidence = 0.5;

    if (labels.includes('bounty')) confidence += 0.2;
    if (body.includes('reward') || body.includes('$')) confidence += 0.1;
    if (body.includes('acceptance criteria')) confidence += 0.1;
    if (body.length < 50) confidence -= 0.2;

    return Math.min(1, Math.max(0, confidence));
  }
}

/**
 * Create a default BountyHunter.
 *
 * @param config - Orchestrator configuration.
 * @returns A configured BountyHunter.
 */
export function createBountyHunter(config: BountyHunterConfig): BountyHunter {
  return new BountyHunter(config);
}