/**
 * Submitter agent — submits the final pull request to GitHub.
 *
 * The submitter agent creates a feature branch, commits the generated
 * files, pushes to the remote, and opens a pull request referencing the
 * bounty issue. It supports appending a wallet address to the PR title
 * for bounty payment.
 *
 * @module agent/submitter
 */

import { BaseAgent } from './agent.js';
import { AgentRole, type PRSubmissionConfig } from './types.js';
import { NetworkError, SolFoundryError } from '../errors.js';

/**
 * Result of the PR submission step.
 */
export interface SubmissionResult {
  /** Whether the PR was created successfully. */
  readonly success: boolean;
  /** PR number if created. */
  readonly prNumber: number | null;
  /** PR URL if created. */
  readonly prUrl: string | null;
  /** Error message if submission failed. */
  readonly error: string | null;
}

/**
 * Input for the submitter agent.
 */
export interface SubmitterInput {
  /** Files to include in the PR. */
  readonly files: Array<{ readonly filePath: string; readonly content: string }>;
  /** PR submission configuration. */
  readonly config: PRSubmissionConfig;
  /** GitHub token for API access. */
  readonly githubToken: string;
}

/**
 * The submitter agent creates a pull request on GitHub containing the
 * generated files. It builds a feature branch, commits, pushes, and
 * opens a PR referencing the bounty issue.
 */
export class SubmitterAgent extends BaseAgent {
  readonly role = AgentRole.SUBMITTER;

  /**
   * Execute the submission step.
   *
   * In mock mode, returns a simulated successful result.
   *
   * @param input - A SubmitterInput object.
   * @returns A SubmissionResult.
   */
  async execute(input: unknown): Promise<SubmissionResult> {
    const submitInput = input as SubmitterInput;

    // In mock mode, simulate a successful submission
    if (this.mockMode) {
      return {
        success: true,
        prNumber: 1234,
        prUrl: `https://github.com/${submitInput.config.owner}/${submitInput.config.repo}/pull/1234`,
        error: null,
      };
    }

    try {
      const prUrl = await this.createPullRequest(submitInput);
      const prNumber = this.extractPrNumber(prUrl);
      return {
        success: true,
        prNumber,
        prUrl,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        prNumber: null,
        prUrl: null,
        error: String(error),
      };
    }
  }

  /**
   * Create a pull request via the GitHub API.
   *
   * @param input - Submitter input.
   * @returns The PR URL.
   */
  private async createPullRequest(input: SubmitterInput): Promise<string> {
    const { config, githubToken } = input;

    // 1. Create the branch reference
    const baseSha = await this.getBaseSha(config, githubToken);
    await this.createBranch(config, baseSha, githubToken);

    // 2. Create/update files on the branch
    for (const file of input.files) {
      await this.upsertFile(config, file.filePath, file.content, githubToken);
    }

    // 3. Build the PR title (with wallet address if provided)
    const title = config.walletAddress
      ? `${config.title} [${config.walletAddress}]`
      : config.title;

    // 4. Open the pull request
    const prUrl = await this.openPullRequest(config, title, config.body, githubToken);
    return prUrl;
  }

  /**
   * Get the SHA of the base branch head.
   */
  private async getBaseSha(config: PRSubmissionConfig, token: string): Promise<string> {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/git/refs/heads/${config.baseBranch}`;
    const data = await this.githubFetch<{ object: { sha: string } }>(url, token);
    return data.object.sha;
  }

  /**
   * Create a branch from the base SHA.
   */
  private async createBranch(
    config: PRSubmissionConfig,
    baseSha: string,
    token: string,
  ): Promise<void> {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/git/refs`;
    await this.githubFetch(url, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${config.branchName}`,
        sha: baseSha,
      }),
    });
  }

  /**
   * Create or update a file on the branch.
   */
  private async upsertFile(
    config: PRSubmissionConfig,
    filePath: string,
    content: string,
    token: string,
  ): Promise<void> {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;
    const existing = await this.tryGetFileSha(config, filePath, token);

    const body: Record<string, string> = {
      message: `feat: add ${filePath}`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: config.branchName,
    };

    if (existing) {
      body.sha = existing;
    }

    await this.githubFetch(url, token, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get the SHA of an existing file (if it exists).
   */
  private async tryGetFileSha(
    config: PRSubmissionConfig,
    filePath: string,
    token: string,
  ): Promise<string | null> {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}?ref=${config.branchName}`;
    try {
      const data = await this.githubFetch<{ sha: string }>(url, token);
      return data.sha;
    } catch {
      return null;
    }
  }

  /**
   * Open the pull request.
   */
  private async openPullRequest(
    config: PRSubmissionConfig,
    title: string,
    body: string,
    token: string,
  ): Promise<string> {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/pulls`;
    const data = await this.githubFetch<{ html_url: string }>(url, token, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head: config.branchName,
        base: config.baseBranch,
      }),
    });
    return data.html_url;
  }

  /**
   * Execute a GitHub API request.
   */
  private async githubFetch<T>(
    url: string,
    token: string,
    options?: { method?: string; body?: string },
  ): Promise<T> {
    const method = options?.method ?? 'GET';
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': '@solfoundry/sdk',
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new SolFoundryError(
        `GitHub PR API error: ${errorText}`,
        response.status,
        `GITHUB_${response.status}`,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Extract the PR number from a PR URL.
   */
  private extractPrNumber(prUrl: string): number | null {
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}

/**
 * Create a default submitter agent.
 *
 * @param provider - LLM provider configuration.
 * @param mockMode - Whether to use mock mode.
 * @returns A configured SubmitterAgent.
 */
export function createSubmitter(
  provider: import('./types.js').LLMProviderConfig,
  mockMode: boolean = false,
): SubmitterAgent {
  return new SubmitterAgent(provider, mockMode);
}