/**
 * GitHub App API endpoints for the SolFoundry frontend.
 *
 * Provides API client functions for:
 * - App installation management
 * - Review configuration
 * - Review results retrieval
 * - Webhook status
 *
 * @module api/github-app
 */

import { apiClient } from '../services/apiClient';
import type { ReviewConfig, ReviewStrictness, CommentPreference, LLMProvider } from '../integrations/github-app/ReviewConfig';
import type { GitHubAppManifest, AppPermissions } from '../integrations/github-app/AppManifest';

// ─── Types ───────────────────────────────────────────────────────────────────

/** GitHub App installation status. */
export interface AppInstallation {
  id: number;
  accountId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  repositories: string[];
  config: ReviewConfig;
  installedAt: string;
  updatedAt: string;
}

/** Review result from the AI pipeline. */
export interface ReviewResult {
  id: string;
  prNumber: number;
  repository: string;
  findings: ReviewFinding[];
  providerResults: ProviderReviewResult[];
  summary: string;
  passed: boolean;
  startedAt: string;
  completedAt: string;
}

/** A single review finding. */
export interface ReviewFinding {
  id: string;
  provider: LLMProvider;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  filePath: string;
  line: number;
  title: string;
  description: string;
  suggestion: string;
  category: string;
}

/** Result from a single LLM provider. */
export interface ProviderReviewResult {
  provider: LLMProvider;
  model: string;
  findings: ReviewFinding[];
  success: boolean;
  error?: string;
  durationMs: number;
}

/** Webhook delivery status. */
export interface WebhookStatus {
  active: boolean;
  lastDelivery?: {
    id: string;
    createdAt: string;
    status: string;
    event: string;
  };
  totalDeliveries: number;
}

/** App manifest information. */
export interface AppInfo {
  id: number;
  slug: string;
  name: string;
  description: string;
  installed: boolean;
  installations: AppInstallation[];
  permissions: AppPermissions;
  events: string[];
}

/** Configuration update payload. */
export interface ConfigUpdatePayload {
  strictness?: ReviewStrictness;
  commentPreference?: CommentPreference;
  enabled?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  minLinesChanged?: number;
  reviewDrafts?: boolean;
  customInstructions?: string;
  providers?: Array<{
    provider: LLMProvider;
    enabled: boolean;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }>;
}

/** Trigger review payload. */
export interface TriggerReviewPayload {
  repository: string;
  prNumber: number;
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Get the AI Code Review app information.
 */
export async function getAppInfo(): Promise<AppInfo> {
  return apiClient<AppInfo>('/api/github-app/info');
}

/**
 * Get all installations of the app.
 */
export async function getAppInstallations(): Promise<AppInstallation[]> {
  return apiClient<AppInstallation[]>('/api/github-app/installations');
}

/**
 * Get a specific installation by ID.
 */
export async function getInstallation(installationId: number): Promise<AppInstallation> {
  return apiClient<AppInstallation>(`/api/github-app/installations/${installationId}`);
}

/**
 * Get the review configuration for a repository.
 */
export async function getReviewConfig(repository: string): Promise<ReviewConfig> {
  return apiClient<ReviewConfig>('/api/github-app/config', {
    params: { repository },
  });
}

/**
 * Update the review configuration for a repository.
 */
export async function updateReviewConfig(
  repository: string,
  payload: ConfigUpdatePayload,
): Promise<ReviewConfig> {
  return apiClient<ReviewConfig>(`/api/github-app/config/${repository}`, {
    method: 'PUT',
    body: payload,
  });
}

/**
 * Reset the review configuration to defaults.
 */
export async function resetReviewConfig(repository: string): Promise<ReviewConfig> {
  return apiClient<ReviewConfig>(`/api/github-app/config/${repository}`, {
    method: 'DELETE',
  });
}

/**
 * Get review results for a PR.
 */
export async function getReviewResults(
  repository: string,
  prNumber: number,
): Promise<ReviewResult[]> {
  return apiClient<ReviewResult[]>('/api/github-app/reviews', {
    params: { repository, pr_number: prNumber },
  });
}

/**
 * Get a specific review result by ID.
 */
export async function getReviewResult(reviewId: string): Promise<ReviewResult> {
  return apiClient<ReviewResult>(`/api/github-app/reviews/${reviewId}`);
}

/**
 * Manually trigger a review for a PR.
 */
export async function triggerReview(payload: TriggerReviewPayload): Promise<{ reviewId: string }> {
  return apiClient<{ reviewId: string }>('/api/github-app/reviews/trigger', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Get webhook delivery status.
 */
export async function getWebhookStatus(): Promise<WebhookStatus> {
  return apiClient<WebhookStatus>('/api/github-app/webhook/status');
}

/**
 * Redeliver a failed webhook delivery.
 */
export async function redeliverWebhook(deliveryId: string): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/api/github-app/webhook/deliveries/${deliveryId}/redeliver`, {
    method: 'POST',
  });
}

/**
 * Get the app manifest for one-click installation.
 */
export async function getAppManifest(): Promise<GitHubAppManifest> {
  return apiClient<GitHubAppManifest>('/api/github-app/manifest');
}

/**
 * Get the one-click installation URL.
 */
export async function getInstallUrl(): Promise<{ url: string }> {
  return apiClient<{ url: string }>('/api/github-app/install-url');
}

/**
 * Uninstall the app from a repository/account.
 */
export async function uninstallApp(installationId: number): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/api/github-app/installations/${installationId}`, {
    method: 'DELETE',
  });
}
