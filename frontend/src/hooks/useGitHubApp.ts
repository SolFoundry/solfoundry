/**
 * useGitHubApp — React hook for managing the AI Code Review GitHub App.
 *
 * Provides state and actions for:
 * - App installation status
 * - Review configuration
 * - Review results
 * - Webhook status
 *
 * Built on top of React Query for caching and automatic refetching.
 *
 * @module hooks/useGitHubApp
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import * as githubAppApi from '../api/github-app';
import type { AppInstallation, ReviewResult, ConfigUpdatePayload, LLMProvider } from '../api/github-app';
import type { ReviewConfig, ReviewStrictness, CommentPreference } from '../integrations/github-app/ReviewConfig';

// ─── Query Keys ──────────────────────────────────────────────────────────────

const QUERY_KEYS = {
  appInfo: ['github-app', 'info'] as const,
  installations: ['github-app', 'installations'] as const,
  installation: (id: number) => ['github-app', 'installations', id] as const,
  config: (repo: string) => ['github-app', 'config', repo] as const,
  reviews: (repo: string, pr: number) => ['github-app', 'reviews', repo, pr] as const,
  review: (id: string) => ['github-app', 'review', id] as const,
  webhookStatus: ['github-app', 'webhook-status'] as const,
  installUrl: ['github-app', 'install-url'] as const,
} as const;

// ─── Main Hook ───────────────────────────────────────────────────────────────

interface UseGitHubAppOptions {
  /** Repository to load config for (optional) */
  repository?: string;
  /** PR number to load reviews for (optional) */
  prNumber?: number;
}

export function useGitHubApp(options: UseGitHubAppOptions = {}) {
  const queryClient = useQueryClient();
  const { repository, prNumber } = options;

  // ── App Info ──────────────────────────────────────────────────────────────

  const appInfoQuery = useQuery({
    queryKey: QUERY_KEYS.appInfo,
    queryFn: githubAppApi.getAppInfo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // ── Installations ─────────────────────────────────────────────────────────

  const installationsQuery = useQuery({
    queryKey: QUERY_KEYS.installations,
    queryFn: githubAppApi.getAppInstallations,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  // ── Review Config ─────────────────────────────────────────────────────────

  const configQuery = useQuery({
    queryKey: repository ? QUERY_KEYS.config(repository) : ['github-app', 'config'],
    queryFn: () => (repository ? githubAppApi.getReviewConfig(repository) : githubAppApi.getReviewConfig('*')),
    enabled: !!repository || true, // Always load global config
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Review Results ────────────────────────────────────────────────────────

  const reviewsQuery = useQuery({
    queryKey: repository && prNumber ? QUERY_KEYS.reviews(repository, prNumber) : ['github-app', 'reviews'],
    queryFn: () =>
      repository && prNumber
        ? githubAppApi.getReviewResults(repository, prNumber)
        : Promise.resolve([]),
    enabled: !!repository && !!prNumber,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });

  // ── Webhook Status ────────────────────────────────────────────────────────

  const webhookStatusQuery = useQuery({
    queryKey: QUERY_KEYS.webhookStatus,
    queryFn: githubAppApi.getWebhookStatus,
    staleTime: 1 * 60 * 1000, // 1 minute
    retry: 1,
  });

  // ── Install URL ───────────────────────────────────────────────────────────

  const installUrlQuery = useQuery({
    queryKey: QUERY_KEYS.installUrl,
    queryFn: githubAppApi.getInstallUrl,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateConfigMutation = useMutation({
    mutationFn: ({ repo, payload }: { repo: string; payload: ConfigUpdatePayload }) =>
      githubAppApi.updateReviewConfig(repo, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.config(variables.repo) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.installations });
    },
  });

  const triggerReviewMutation = useMutation({
    mutationFn: githubAppApi.triggerReview,
    onSuccess: () => {
      if (repository && prNumber) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reviews(repository, prNumber) });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reviews });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: githubAppApi.uninstallApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.installations });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appInfo });
    },
  });

  const redeliverWebhookMutation = useMutation({
    mutationFn: githubAppApi.redeliverWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.webhookStatus });
    },
  });

  // ── Convenience Actions ───────────────────────────────────────────────────

  const updateStrictness = useCallback(
    (repo: string, strictness: ReviewStrictness) => {
      updateConfigMutation.mutate({
        repo,
        payload: { strictness },
      });
    },
    [updateConfigMutation],
  );

  const updateCommentPreference = useCallback(
    (repo: string, preference: CommentPreference) => {
      updateConfigMutation.mutate({
        repo,
        payload: { commentPreference: preference },
      });
    },
    [updateConfigMutation],
  );

  const toggleProvider = useCallback(
    (repo: string, provider: LLMProvider, enabled: boolean) => {
      const currentConfig = configQuery.data;
      if (!currentConfig) return;

      const updatedProviders = currentConfig.providers.map((p) =>
        p.provider === provider ? { ...p, enabled } : p,
      );

      updateConfigMutation.mutate({
        repo,
        payload: { providers: updatedProviders },
      });
    },
    [configQuery.data, updateConfigMutation],
  );

  const triggerReview = useCallback(
    (repo: string, pr: number) => {
      triggerReviewMutation.mutate({ repository: repo, prNumber: pr });
    },
    [triggerReviewMutation],
  );

  const uninstallApp = useCallback(
    (installationId: number) => {
      uninstallMutation.mutate(installationId);
    },
    [uninstallMutation],
  );

  // ── Derived State ─────────────────────────────────────────────────────────

  const isInstalled = installationsQuery.data
    ? installationsQuery.data.length > 0
    : appInfoQuery.data?.installed ?? false;

  const isLoading =
    appInfoQuery.isLoading ||
    installationsQuery.isLoading ||
    configQuery.isLoading ||
    webhookStatusQuery.isLoading;

  const error = appInfoQuery.error || installationsQuery.error || configQuery.error;

  return {
    // App info
    appInfo: appInfoQuery.data,
    appInfoLoading: appInfoQuery.isLoading,
    appInfoError: appInfoQuery.error,

    // Installations
    installations: installationsQuery.data ?? [],
    installationsLoading: installationsQuery.isLoading,
    isInstalled,

    // Config
    config: configQuery.data,
    configLoading: configQuery.isLoading,
    updateConfig: updateConfigMutation.mutate,
    updateStrictness,
    updateCommentPreference,
    toggleProvider,
    configError: configQuery.error,

    // Reviews
    reviews: reviewsQuery.data ?? [],
    reviewsLoading: reviewsQuery.isLoading,
    triggerReview,
    triggerReviewLoading: triggerReviewMutation.isPending,

    // Webhook
    webhookStatus: webhookStatusQuery.data,
    webhookStatusLoading: webhookStatusQuery.isLoading,
    redeliverWebhook: redeliverWebhookMutation.mutate,

    // Install URL
    installUrl: installUrlQuery.data?.url,
    installUrlLoading: installUrlQuery.isLoading,

    // General
    isLoading,
    error,
    uninstallApp,
    uninstallLoading: uninstallMutation.isPending,
  };
}

// ─── Individual Query Hooks ──────────────────────────────────────────────────

/** Hook to get a specific installation by ID. */
export function useInstallation(installationId: number | null) {
  return useQuery({
    queryKey: installationId ? QUERY_KEYS.installation(installationId) : ['github-app', 'installation'],
    queryFn: () => (installationId ? githubAppApi.getInstallation(installationId) : Promise.resolve(null)),
    enabled: installationId !== null && installationId !== undefined,
    staleTime: 2 * 60 * 1000,
  });
}

/** Hook to get a specific review result. */
export function useReviewResult(reviewId: string | null) {
  return useQuery({
    queryKey: reviewId ? QUERY_KEYS.review(reviewId) : ['github-app', 'review'],
    queryFn: () => (reviewId ? githubAppApi.getReviewResult(reviewId) : Promise.resolve(null)),
    enabled: !!reviewId,
    staleTime: 30 * 1000,
  });
}
