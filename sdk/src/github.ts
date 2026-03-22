/**
 * GitHub API wrapper for SolFoundry bounty operations.
 *
 * Provides methods to list bounties from GitHub Issues, check claim
 * status via pull requests, and verify bounty completion. Uses the
 * public GitHub REST API (v3) with optional authentication for
 * higher rate limits.
 *
 * @module github
 */

import type { GitHubBountyIssue, GitHubPullRequest } from './types.js';
import { NetworkError, SolFoundryError } from './errors.js';

/** Default owner/repo for the SolFoundry GitHub repository. */
const DEFAULT_OWNER = 'SolFoundry';
const DEFAULT_REPO = 'solfoundry';
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Configuration for the GitHub API client.
 */
export interface GitHubClientConfig {
  /** GitHub personal access token for authenticated requests (higher rate limits). */
  readonly token?: string;
  /** Repository owner (organization or user). Defaults to "SolFoundry". */
  readonly owner?: string;
  /** Repository name. Defaults to "solfoundry". */
  readonly repo?: string;
}

/**
 * Client for interacting with GitHub Issues and Pull Requests
 * related to SolFoundry bounties.
 *
 * Maps GitHub Issues with bounty labels to structured bounty objects,
 * checks PR-based claim status, and verifies bounty completion through
 * merged PRs.
 *
 * @example
 * ```typescript
 * const github = new GitHubClient({ token: 'ghp_xxx' });
 *
 * // List all open bounty issues
 * const bounties = await github.listBountyIssues({ state: 'open' });
 *
 * // Check if a specific bounty has been claimed
 * const prs = await github.listPullRequestsForIssue(42);
 * const claimed = prs.length > 0;
 * ```
 */
export class GitHubClient {
  private readonly token: string | undefined;
  private readonly owner: string;
  private readonly repo: string;

  /**
   * Create a new GitHubClient.
   *
   * @param config - Configuration with optional token, owner, and repo.
   */
  constructor(config: GitHubClientConfig = {}) {
    this.token = config.token;
    this.owner = config.owner ?? DEFAULT_OWNER;
    this.repo = config.repo ?? DEFAULT_REPO;
  }

  /**
   * List GitHub issues that represent SolFoundry bounties.
   *
   * Fetches issues with bounty-related labels (e.g., "bounty", "tier-1",
   * "tier-2", "tier-3") and maps them to structured bounty objects.
   *
   * @param options - Filtering options for the issue listing.
   * @param options.state - Issue state filter ("open", "closed", or "all"). Defaults to "open".
   * @param options.labels - Additional label filters (comma-separated).
   * @param options.page - Page number for pagination (1-based).
   * @param options.perPage - Results per page (max 100). Defaults to 30.
   * @returns Array of GitHub bounty issues.
   */
  async listBountyIssues(options?: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    page?: number;
    perPage?: number;
  }): Promise<GitHubBountyIssue[]> {
    const params = new URLSearchParams();
    params.set('state', options?.state ?? 'open');
    params.set('labels', options?.labels ?? 'bounty');
    if (options?.page) params.set('page', String(options.page));
    if (options?.perPage) params.set('per_page', String(options.perPage));

    const url = `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/issues?${params}`;
    const data = await this.fetchGitHub<GitHubIssueRaw[]>(url);

    return data
      .filter((issue) => !issue.pull_request) // Exclude PRs from issue listing
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body ?? '',
        state: issue.state,
        labels: issue.labels.map((label) =>
          typeof label === 'string' ? label : label.name ?? '',
        ),
        html_url: issue.html_url,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
      }));
  }

  /**
   * Get a specific GitHub issue by number.
   *
   * @param issueNumber - The GitHub issue number.
   * @returns The issue mapped to a GitHubBountyIssue.
   * @throws {NotFoundError} If the issue does not exist.
   */
  async getIssue(issueNumber: number): Promise<GitHubBountyIssue> {
    const url = `${GITHUB_API_BASE}/repos/${this.owner}/${this.repo}/issues/${issueNumber}`;
    const issue = await this.fetchGitHub<GitHubIssueRaw>(url);

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body ?? '',
      state: issue.state,
      labels: issue.labels.map((label) =>
        typeof label === 'string' ? label : label.name ?? '',
      ),
      html_url: issue.html_url,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    };
  }

  /**
   * List pull requests that reference a specific issue number.
   *
   * Searches for PRs whose title or body contains "Closes #N" or
   * "Fixes #N" patterns, which indicates a claim on that bounty.
   *
   * @param issueNumber - The GitHub issue number to search claims for.
   * @param options - Optional filtering options.
   * @param options.state - PR state filter ("open", "closed", or "all"). Defaults to "all".
   * @returns Array of pull requests referencing the issue.
   */
  async listPullRequestsForIssue(
    issueNumber: number,
    options?: { state?: 'open' | 'closed' | 'all' },
  ): Promise<GitHubPullRequest[]> {
    const searchQuery = `repo:${this.owner}/${this.repo} is:pr ${issueNumber} in:body`;
    const params = new URLSearchParams();
    params.set('q', searchQuery);

    const url = `${GITHUB_API_BASE}/search/issues?${params}`;
    const data = await this.fetchGitHub<GitHubSearchResult>(url);

    const stateFilter = options?.state ?? 'all';

    return data.items
      .filter((item) => {
        if (stateFilter === 'all') return true;
        if (stateFilter === 'closed') return item.state === 'closed';
        return item.state === 'open';
      })
      .map((item) => ({
        number: item.number,
        title: item.title,
        state: item.pull_request?.merged_at ? 'merged' : item.state,
        merged: !!item.pull_request?.merged_at,
        html_url: item.html_url,
        head_branch: item.pull_request?.head?.ref ?? '',
        base_branch: item.pull_request?.base?.ref ?? '',
        created_at: item.created_at,
      }));
  }

  /**
   * Check whether a bounty issue has been claimed (has open PRs).
   *
   * A bounty is considered "claimed" if there is at least one open
   * pull request referencing it.
   *
   * @param issueNumber - The GitHub issue number to check.
   * @returns True if the bounty has at least one open PR.
   */
  async isIssueClaimed(issueNumber: number): Promise<boolean> {
    const pullRequests = await this.listPullRequestsForIssue(issueNumber, { state: 'open' });
    return pullRequests.length > 0;
  }

  /**
   * Verify whether a bounty has been completed (has a merged PR).
   *
   * A bounty is considered "completed" when at least one PR
   * referencing it has been merged into the base branch.
   *
   * @param issueNumber - The GitHub issue number to verify.
   * @returns True if the bounty has at least one merged PR.
   */
  async isIssueCompleted(issueNumber: number): Promise<boolean> {
    const pullRequests = await this.listPullRequestsForIssue(issueNumber);
    return pullRequests.some((pr) => pr.merged);
  }

  /**
   * Execute a GitHub API request with authentication and error handling.
   *
   * @typeParam T - Expected response type.
   * @param url - Full GitHub API URL.
   * @returns Parsed JSON response.
   * @throws {SolFoundryError} On API errors.
   * @throws {NetworkError} On network failures.
   */
  private async fetchGitHub<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': '@solfoundry/sdk',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new SolFoundryError(
          `GitHub API error: ${errorText}`,
          response.status,
          `GITHUB_${response.status}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SolFoundryError) {
        throw error;
      }
      throw new NetworkError(
        `GitHub API request failed: ${String(error)}`,
        error as Error,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Internal GitHub API response types (not exported)
// ---------------------------------------------------------------------------

/** Raw GitHub Issue from the REST API. */
interface GitHubIssueRaw {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<string | { name?: string }>;
  html_url: string;
  created_at: string;
  updated_at: string;
  pull_request?: { url?: string };
}

/** Raw GitHub Search result from the REST API. */
interface GitHubSearchResult {
  total_count: number;
  items: Array<{
    number: number;
    title: string;
    state: string;
    html_url: string;
    created_at: string;
    pull_request?: {
      merged_at: string | null;
      head?: { ref: string };
      base?: { ref: string };
    };
  }>;
}
