/**
 * GitHubApp — GitHub App webhook handler for the AI Code Review integration.
 *
 * Handles GitHub webhook events (pull_request, pull_request_review_comment)
 * and triggers the Multi-LLM review pipeline.
 *
 * Designed to run as an Express.js middleware/endpoint.
 *
 * @module integrations/github-app/GitHubApp
 */

import type { ReviewConfig, ReviewStrictness, CommentPreference } from './ReviewConfig';
import { createDefaultConfig, validateConfig } from './ReviewConfig';
import { multiLLMReviewer, type ReviewInput, type ReviewResult } from './MultiLLMReviewer';

// ─── Types ───────────────────────────────────────────────────────────────────

/** GitHub webhook event payload for pull_request events. */
export interface PullRequestWebhookPayload {
  action: 'opened' | 'synchronize' | 'reopened' | 'ready_for_review';
  pull_request: {
    number: number;
    title: string;
    body: string;
    head: { ref: string; sha: string };
    base: { ref: string; sha: string };
    draft: boolean;
    state: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
    changed_files: number;
    additions: number;
    deletions: number;
  };
  repository: {
    full_name: string;
    name: string;
    owner: { login: string };
  };
  installation?: { id: number };
}

/** GitHub webhook event types we handle. */
export type GitHubWebhookEvent =
  | 'pull_request'
  | 'pull_request_review_comment'
  | 'installation'
  | 'installation_repositories';

/** Installation record for a GitHub App installation. */
export interface Installation {
  id: number;
  accountId: number;
  accountLogin: string;
  accountType: string;
  repositories: string[];
  config: ReviewConfig;
  createdAt: string;
  updatedAt: string;
}

/** Webhook handler result. */
export interface WebhookResult {
  success: boolean;
  reviewId?: string;
  message: string;
  error?: string;
}

// ─── In-memory storage (production would use a database) ─────────────────────

const installations = new Map<number, Installation>();
const reviewConfigs = new Map<string, ReviewConfig>();
const reviewResults = new Map<string, ReviewResult>();

// ─── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify GitHub webhook signature (HMAC SHA256).
 * In production, use the actual secret from environment variables.
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const crypto = await import('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

/**
 * Process an incoming GitHub webhook event.
 *
 * This is the main entry point for the GitHub App webhook handler.
 * It routes events to the appropriate handlers and returns a result.
 *
 * @param event - The GitHub webhook event type (X-GitHub-Event header)
 * @param deliveryId - The webhook delivery ID (X-GitHub-Delivery header)
 * @param payload - The parsed webhook payload
 * @returns Webhook processing result
 */
export async function handleWebhook(
  event: GitHubWebhookEvent,
  deliveryId: string,
  payload: unknown,
): Promise<WebhookResult> {
  try {
    switch (event) {
      case 'pull_request':
        return handlePullRequest(payload as PullRequestWebhookPayload);
      case 'installation':
        return handleInstallation(payload as Record<string, unknown>);
      case 'installation_repositories':
        return handleInstallationRepositories(payload as Record<string, unknown>);
      default:
        return { success: true, message: `Event '${event}' acknowledged (no action)` };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to process ${event} webhook`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle pull_request webhook events.
 * Triggers AI review on PR open, sync, or reopen.
 */
async function handlePullRequest(payload: PullRequestWebhookPayload): Promise<WebhookResult> {
  const { action, pull_request: pr, repository } = payload;

  // Only review on relevant actions
  if (!['opened', 'synchronize', 'reopened', 'ready_for_review'].includes(action)) {
    return { success: true, message: `Action '${action}' ignored` };
  }

  // Skip draft PRs if configured
  if (pr.draft) {
    const config = getRepoConfig(repository.full_name);
    if (!config.reviewDrafts) {
      return { success: true, message: 'Draft PR — review skipped' };
    }
  }

  // Check minimum lines changed
  const totalChanges = pr.additions + pr.deletions;
  const config = getRepoConfig(repository.full_name);
  if (totalChanges < config.minLinesChanged) {
    return { success: true, message: `Changes (${totalChanges} lines) below minimum (${config.minLinesChanged})` };
  }

  // Build review input
  const reviewInput: ReviewInput = {
    prNumber: pr.number,
    repository: repository.full_name,
    prTitle: pr.title,
    prBody: pr.body ?? '',
    changedFiles: [], // Would be populated from GitHub API in production
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
  };

  // Run the multi-LLM review
  const result = await multiLLMReviewer.review(reviewInput, config);
  reviewResults.set(result.id, result);

  // Format and post comments based on preference
  const comments = multiLLMReviewer.formatComments(result, config.commentPreference);

  // In production, these would be posted via GitHub API
  // For now, we store them for retrieval
  if (comments.inline.length > 0) {
    console.log(`[GitHubApp] ${comments.inline.length} inline comments ready for PR #${pr.number}`);
  }
  if (comments.summary) {
    console.log(`[GitHubApp] Summary comment ready for PR #${pr.number}`);
  }

  return {
    success: true,
    reviewId: result.id,
    message: `Review completed: ${result.findings.length} findings across ${result.providerResults.length} providers`,
  };
}

/**
 * Handle installation webhook events.
 * Stores installation data when the app is installed on a repo/account.
 */
async function handleInstallation(payload: Record<string, unknown>): Promise<WebhookResult> {
  const action = payload.action as string;
  const installation = payload.installation as Record<string, unknown>;

  if (action === 'created' || action === 'new') {
    const installId = Number(installation.id);
    const account = installation.account as Record<string, unknown>;
    const repositories = (payload.repositories as Array<{ full_name: string }> | undefined)?.map(
      (r) => r.full_name,
    ) ?? [];

    const config = createDefaultConfig('*', 'normal');
    config.repository = repositories.join(', ') || '*';

    installations.set(installId, {
      id: installId,
      accountId: Number(account.id),
      accountLogin: account.login as string,
      accountType: account.type as string,
      repositories,
      config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true, message: `App installed for ${account.login}` };
  }

  if (action === 'deleted' || action === 'suspend') {
    const installId = Number(installation.id);
    installations.delete(installId);
    return { success: true, message: `App ${action}ed for installation ${installId}` };
  }

  return { success: true, message: `Installation action '${action}' acknowledged` };
}

/**
 * Handle installation_repositories webhook events.
 * Updates repository list when repositories are added/removed.
 */
async function handleInstallationRepositories(
  payload: Record<string, unknown>,
): Promise<WebhookResult> {
  const installation = payload.installation as Record<string, unknown>;
  const installId = Number(installation.id);
  const action = payload.action as string;

  const existing = installations.get(installId);
  if (!existing) {
    return { success: false, message: 'Installation not found', error: 'Installation not registered' };
  }

  const repositoriesToAdd = (payload.repository_selection as unknown as { action: string; repositories: Array<{ full_name: string }> })?.repositories ?? [];

  if (action === 'added') {
    existing.repositories = Array.from(
      new Set([...existing.repositories, ...repositoriesToAdd.map((r) => r.full_name)]),
    );
  } else if (action === 'removed') {
    const removed = repositoriesToAdd.map((r) => r.full_name);
    existing.repositories = existing.repositories.filter((r) => !removed.includes(r));
  }

  existing.updatedAt = new Date().toISOString();
  installations.set(installId, existing);

  return { success: true, message: `Repositories updated for installation ${installId}` };
}

// ─── Configuration management ────────────────────────────────────────────────

/**
 * Get the review configuration for a repository.
 * Falls back to the global (*) config if no repo-specific config exists.
 */
export function getRepoConfig(repository: string): ReviewConfig {
  const repoConfig = reviewConfigs.get(repository);
  const globalConfig = reviewConfigs.get('*');

  if (repoConfig) return repoConfig;
  if (globalConfig) return globalConfig;

  // Create and cache a default config
  const defaultConfig = createDefaultConfig(repository, 'normal');
  reviewConfigs.set(repository, defaultConfig);
  return defaultConfig;
}

/**
 * Update the review configuration for a repository.
 */
export function updateRepoConfig(repository: string, config: Partial<ReviewConfig>): ReviewConfig {
  const existing = getRepoConfig(repository);
  const updated: ReviewConfig = {
    ...existing,
    ...config,
    id: config.id ?? existing.id,
    repository,
    updatedAt: new Date().toISOString(),
  };

  const errors = validateConfig(updated);
  if (errors.length > 0) {
    throw new Error(`Invalid configuration: ${errors.join('; ')}`);
  }

  reviewConfigs.set(repository, updated);
  return updated;
}

/**
 * Get all stored review configurations.
 */
export function getAllConfigs(): ReviewConfig[] {
  return Array.from(reviewConfigs.values());
}

/**
 * Get a review result by ID.
 */
export function getReviewResult(reviewId: string): ReviewResult | undefined {
  return reviewResults.get(reviewId);
}

/**
 * Get all review results for a PR.
 */
export function getReviewResultsForPR(repository: string, prNumber: number): ReviewResult[] {
  return Array.from(reviewResults.values()).filter(
    (r) => r.repository === repository && r.prNumber === prNumber,
  );
}

// ─── Express middleware factory ──────────────────────────────────────────────

/**
 * Create an Express middleware handler for GitHub webhooks.
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { createWebhookMiddleware } from './GitHubApp';
 *
 * const app = express();
 * app.use('/api/github/webhook', createWebhookMiddleware({
 *   secret: process.env.GITHUB_WEBHOOK_SECRET!,
 * }));
 * ```
 */
export function createWebhookMiddleware(options: {
  secret: string;
  onReviewComplete?: (result: ReviewResult) => void;
}) {
  // This is a type definition / factory — actual Express usage would be in a server file.
  // We return the handler function that Express would call.
  return async function githubWebhookHandler(
    req: { headers: Record<string, string | undefined>; body: unknown },
    res: { status: (code: number) => { json: (body: unknown) => void } },
  ) {
    const event = req.headers['x-github-event'] as GitHubWebhookEvent | undefined;
    const deliveryId = req.headers['x-github-delivery'] ?? 'unknown';

    if (!event) {
      return res.status(400).json({ error: 'Missing X-GitHub-Event header' });
    }

    // Verify signature (in production)
    const signature = req.headers['x-hub-signature-256'] ?? '';
    if (signature && options.secret) {
      const payload = JSON.stringify(req.body);
      const isValid = await verifyWebhookSignature(payload, signature, options.secret);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const result = await handleWebhook(event, deliveryId, req.body);

    if (result.success && result.reviewId && options.onReviewComplete) {
      const reviewResult = getReviewResult(result.reviewId);
      if (reviewResult) {
        options.onReviewComplete(reviewResult);
      }
    }

    return res.status(result.success ? 200 : 500).json(result);
  };
}
