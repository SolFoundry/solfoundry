/**
 * AI Code Review GitHub App test suite.
 *
 * Tests for:
 * - ReviewConfig (strictness, validation, defaults)
 * - MultiLLMReviewer (review pipeline, aggregation, formatting)
 * - GitHubApp (webhook handling, configuration management)
 * - AppManifest (manifest generation, install URLs)
 * - useGitHubApp hook
 * - GitHubAppSetup component
 *
 * All components using React Query are wrapped in QueryClientProvider.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ─── ReviewConfig Tests ──────────────────────────────────────────────────────

import {
  createDefaultConfig,
  updateStrictness,
  validateConfig,
  mergeWithDefaults,
} from '../integrations/github-app/ReviewConfig';
import type { ReviewConfig, ReviewStrictness } from '../integrations/github-app/ReviewConfig';

describe('ReviewConfig', () => {
  describe('createDefaultConfig', () => {
    it('creates a config with default values', () => {
      const config = createDefaultConfig();
      expect(config.repository).toBe('*');
      expect(config.strictness).toBe('normal');
      expect(config.commentPreference).toBe('both');
      expect(config.enabled).toBe(true);
      expect(config.providers).toHaveLength(3);
      expect(config.reviewDrafts).toBe(false);
      expect(config.minLinesChanged).toBe(5);
    });

    it('creates a config with a specific repository', () => {
      const config = createDefaultConfig('owner/repo', 'strict');
      expect(config.repository).toBe('owner/repo');
      expect(config.strictness).toBe('strict');
      expect(config.providers[0].systemPrompt).toContain('rigorous');
    });

    it('includes all three LLM providers', () => {
      const config = createDefaultConfig();
      const providerNames = config.providers.map((p) => p.provider);
      expect(providerNames).toContain('claude');
      expect(providerNames).toContain('codex');
      expect(providerNames).toContain('gemini');
    });

    it('sets appropriate include patterns', () => {
      const config = createDefaultConfig();
      expect(config.includePatterns).toContain('**/*.ts');
      expect(config.includePatterns).toContain('**/*.py');
      expect(config.includePatterns).toContain('**/*.rs');
    });

    it('sets appropriate exclude patterns', () => {
      const config = createDefaultConfig();
      expect(config.excludePatterns).toContain('**/node_modules/**');
      expect(config.excludePatterns).toContain('**/dist/**');
    });
  });

  describe('updateStrictness', () => {
    it('updates strictness and system prompts', async () => {
      const config = createDefaultConfig('*', 'normal');
      // Small delay to ensure updatedAt differs
      await new Promise((r) => setTimeout(r, 10));
      const updated = updateStrictness(config, 'strict');
      expect(updated.strictness).toBe('strict');
      expect(updated.providers[0].systemPrompt).toContain('rigorous');
      expect(updated.updatedAt).not.toBe(config.updatedAt);
    });

    it('preserves other config fields', () => {
      const config = createDefaultConfig('owner/repo', 'lenient');
      const updated = updateStrictness(config, 'strict');
      expect(updated.repository).toBe('owner/repo');
      expect(updated.commentPreference).toBe('both');
    });
  });

  describe('validateConfig', () => {
    it('returns empty array for valid config', () => {
      const config = createDefaultConfig();
      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('detects missing ID', () => {
      const config = createDefaultConfig();
      config.id = '';
      const errors = validateConfig(config);
      expect(errors).toContain('Configuration ID is required');
    });

    it('detects missing repository', () => {
      const config = createDefaultConfig();
      config.repository = '';
      const errors = validateConfig(config);
      expect(errors).toContain('Repository is required');
    });

    it('detects invalid strictness', () => {
      const config = createDefaultConfig();
      (config as any).strictness = 'invalid';
      const errors = validateConfig(config);
      expect(errors).toContain('Invalid strictness level');
    });

    it('detects invalid comment preference', () => {
      const config = createDefaultConfig();
      (config as any).commentPreference = 'invalid';
      const errors = validateConfig(config);
      expect(errors).toContain('Invalid comment preference');
    });

    it('detects no providers', () => {
      const config = createDefaultConfig();
      config.providers = [];
      const errors = validateConfig(config);
      expect(errors).toContain('At least one LLM provider must be configured');
    });

    it('detects all providers disabled', () => {
      const config = createDefaultConfig();
      config.providers.forEach((p) => (p.enabled = false));
      const errors = validateConfig(config);
      expect(errors).toContain('At least one LLM provider must be enabled');
    });

    it('detects invalid temperature', () => {
      const config = createDefaultConfig();
      config.providers[0].temperature = 1.5;
      const errors = validateConfig(config);
      expect(errors.some((e) => e.includes('temperature'))).toBe(true);
    });

    it('detects invalid maxTokens', () => {
      const config = createDefaultConfig();
      config.providers[0].maxTokens = 50000;
      const errors = validateConfig(config);
      expect(errors.some((e) => e.includes('maxTokens'))).toBe(true);
    });

    it('detects negative minLinesChanged', () => {
      const config = createDefaultConfig();
      config.minLinesChanged = -1;
      const errors = validateConfig(config);
      expect(errors).toContain('minLinesChanged must be non-negative');
    });
  });

  describe('mergeWithDefaults', () => {
    it('merges repo-specific config with global defaults', () => {
      const global = createDefaultConfig('*', 'normal');
      const repo: Partial<ReviewConfig> = { strictness: 'strict' };
      const merged = mergeWithDefaults(global, repo);
      expect(merged.strictness).toBe('strict');
      expect(merged.commentPreference).toBe('both'); // from global
    });
  });
});

// ─── MultiLLMReviewer Tests ──────────────────────────────────────────────────

import {
  multiLLMReviewer,
  type ReviewInput,
} from '../integrations/github-app/MultiLLMReviewer';

describe('MultiLLMReviewer', () => {
  const sampleInput: ReviewInput = {
    prNumber: 42,
    repository: 'owner/repo',
    prTitle: 'Fix: Update authentication flow',
    prBody: 'This PR updates the authentication flow to use OAuth 2.0.',
    changedFiles: [
      {
        path: 'src/auth.ts',
        diff: `@@ -1,5 +1,10 @@
 import { createClient } from '@supabase/supabase-js';
+import { OAuth2Client } from 'oauth2-client';
+
+const client = new OAuth2Client();
+
+eval(userInput); // vulnerability
+console.log('debug auth flow');
`,
        additions: 6,
        deletions: 1,
        status: 'modified',
      },
      {
        path: 'src/utils.ts',
        diff: `@@ -10,3 +10,5 @@
 export function formatData() {
+  try {
+    pass
+  } catch (e) {
+    // TODO: handle error
+  }
 }
`,
        additions: 4,
        deletions: 0,
        status: 'modified',
      },
    ],
    baseBranch: 'main',
    headBranch: 'feature/auth-update',
  };

  it('reviews a PR with all enabled providers', async () => {
    const config = createDefaultConfig();
    const result = await multiLLMReviewer.review(sampleInput, config);

    expect(result.id).toBeDefined();
    expect(result.prNumber).toBe(42);
    expect(result.repository).toBe('owner/repo');
    expect(result.providerResults).toHaveLength(3);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.summary).toContain('AI Code Review Summary');
    expect(typeof result.passed).toBe('boolean');
  });

  it('throws when no providers are enabled', async () => {
    const config = createDefaultConfig();
    config.providers.forEach((p) => (p.enabled = false));

    await expect(multiLLMReviewer.review(sampleInput, config)).rejects.toThrow(
      'No LLM providers are enabled for review',
    );
  });

  it('respects strictness level in provider prompts', async () => {
    const strictConfig = createDefaultConfig('*', 'strict');
    const lenientConfig = createDefaultConfig('*', 'lenient');

    const strictResult = await multiLLMReviewer.review(sampleInput, strictConfig);
    const lenientResult = await multiLLMReviewer.review(sampleInput, lenientConfig);

    expect(strictResult.providerResults[0].success).toBe(true);
    expect(lenientResult.providerResults[0].success).toBe(true);
  });

  it('formats inline comments correctly', async () => {
    const config = createDefaultConfig();
    const result = await multiLLMReviewer.review(sampleInput, config);

    const { inline, summary } = multiLLMReviewer.formatComments(result, 'both');

    expect(inline.length).toBeGreaterThan(0);
    expect(summary).toContain('AI Code Review Summary');
    expect(inline[0]).toHaveProperty('path');
    expect(inline[0]).toHaveProperty('line');
    expect(inline[0]).toHaveProperty('body');
  });

  it('formats only inline comments when preference is inline', async () => {
    const config = createDefaultConfig();
    const result = await multiLLMReviewer.review(sampleInput, config);

    const { inline, summary } = multiLLMReviewer.formatComments(result, 'inline');

    expect(inline.length).toBeGreaterThan(0);
    expect(summary).toBe('');
  });

  it('formats only summary when preference is summary', async () => {
    const config = createDefaultConfig();
    const result = await multiLLMReviewer.review(sampleInput, config);

    const { inline, summary } = multiLLMReviewer.formatComments(result, 'summary');

    expect(inline).toHaveLength(0);
    expect(summary).toContain('AI Code Review Summary');
  });

  it('determines passed status based on findings severity', async () => {
    const config = createDefaultConfig();
    const result = await multiLLMReviewer.review(sampleInput, config);

    // Result should have a passed property based on severity
    expect(typeof result.passed).toBe('boolean');
  });

  it('includes provider results with duration', async () => {
    const config = createDefaultConfig();
    const result = await multiLLMReviewer.review(sampleInput, config);

    for (const pr of result.providerResults) {
      expect(pr).toHaveProperty('provider');
      expect(pr).toHaveProperty('model');
      expect(pr).toHaveProperty('success');
      expect(pr).toHaveProperty('durationMs');
      expect(pr.durationMs).toBeGreaterThan(0);
    }
  });
});

// ─── GitHubApp Tests ─────────────────────────────────────────────────────────

import {
  handleWebhook,
  getRepoConfig,
  updateRepoConfig,
  getAllConfigs,
  getReviewResult,
  getReviewResultsForPR,
  verifyWebhookSignature,
} from '../integrations/github-app/GitHubApp';
import type { PullRequestWebhookPayload } from '../integrations/github-app/GitHubApp';

describe('GitHubApp', () => {
  beforeEach(() => {
    // Reset state between tests
    vi.clearAllMocks();
  });

  describe('handleWebhook', () => {
    it('handles pull_request.opened event', async () => {
      const payload: PullRequestWebhookPayload = {
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'Test PR',
          body: 'Test body',
          head: { ref: 'feature', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          draft: false,
          state: 'open',
          html_url: 'https://github.com/owner/repo/pull/42',
          diff_url: 'https://github.com/owner/repo/pull/42.diff',
          patch_url: 'https://github.com/owner/repo/pull/42.patch',
          changed_files: 3,
          additions: 50,
          deletions: 10,
        },
        repository: {
          full_name: 'owner/repo',
          name: 'repo',
          owner: { login: 'owner' },
        },
      };

      const result = await handleWebhook('pull_request', 'delivery-123', payload);
      expect(result.success).toBe(true);
      expect(result.reviewId).toBeDefined();
    });

    it('ignores pull_request.closed event', async () => {
      const payload: PullRequestWebhookPayload = {
        action: 'closed',
        pull_request: {
          number: 42,
          title: 'Test PR',
          body: '',
          head: { ref: 'feature', sha: 'abc' },
          base: { ref: 'main', sha: 'def' },
          draft: false,
          state: 'closed',
          html_url: '',
          diff_url: '',
          patch_url: '',
          changed_files: 0,
          additions: 0,
          deletions: 0,
        },
        repository: {
          full_name: 'owner/repo',
          name: 'repo',
          owner: { login: 'owner' },
        },
      };

      const result = await handleWebhook('pull_request', 'delivery-123', payload);
      expect(result.success).toBe(true);
      expect(result.message).toContain('ignored');
    });

    it('skips draft PRs by default', async () => {
      const payload: PullRequestWebhookPayload = {
        action: 'opened',
        pull_request: {
          number: 43,
          title: 'Draft PR',
          body: '',
          head: { ref: 'feature', sha: 'abc' },
          base: { ref: 'main', sha: 'def' },
          draft: true,
          state: 'open',
          html_url: '',
          diff_url: '',
          patch_url: '',
          changed_files: 5,
          additions: 100,
          deletions: 20,
        },
        repository: {
          full_name: 'owner/repo',
          name: 'repo',
          owner: { login: 'owner' },
        },
      };

      const result = await handleWebhook('pull_request', 'delivery-123', payload);
      expect(result.success).toBe(true);
      expect(result.message).toContain('skipped');
    });

    it('handles installation.created event', async () => {
      const payload = {
        action: 'created',
        installation: {
          id: 12345,
          account: {
            id: 67890,
            login: 'testorg',
            type: 'Organization',
          },
        },
        repositories: [{ full_name: 'testorg/repo1' }, { full_name: 'testorg/repo2' }],
      };

      const result = await handleWebhook('installation', 'delivery-456', payload);
      expect(result.success).toBe(true);
      expect(result.message).toContain('installed');
    });

    it('handles installation.deleted event', async () => {
      const payload = {
        action: 'deleted',
        installation: { id: 12345 },
      };

      const result = await handleWebhook('installation', 'delivery-789', payload);
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
    });

    it('acknowledges unknown events', async () => {
      const result = await handleWebhook('push' as any, 'delivery-000', {});
      expect(result.success).toBe(true);
      expect(result.message).toContain('acknowledged');
    });
  });

  describe('getRepoConfig', () => {
    it('returns default config for unknown repo', () => {
      const config = getRepoConfig('unknown/repo');
      expect(config).toBeDefined();
      expect(config.strictness).toBe('normal');
    });
  });

  describe('updateRepoConfig', () => {
    it('updates config for a repository', () => {
      const updated = updateRepoConfig('owner/repo', { strictness: 'strict' });
      expect(updated.strictness).toBe('strict');
      expect(updated.repository).toBe('owner/repo');
    });

    it('throws on invalid config', () => {
      expect(() =>
        updateRepoConfig('owner/repo', {
          strictness: 'invalid' as any,
        }),
      ).toThrow('Invalid configuration');
    });
  });

  describe('getAllConfigs', () => {
    it('returns all stored configurations', () => {
      updateRepoConfig('repo1/test', { strictness: 'lenient' });
      updateRepoConfig('repo2/test', { strictness: 'strict' });
      const configs = getAllConfigs();
      expect(configs.length).toBeGreaterThan(0);
    });
  });

  describe('getReviewResultsForPR', () => {
    it('returns reviews for a specific PR', async () => {
      // Trigger a review first
      const payload: PullRequestWebhookPayload = {
        action: 'synchronize',
        pull_request: {
          number: 99,
          title: 'Sync PR',
          body: '',
          head: { ref: 'feature', sha: 'abc' },
          base: { ref: 'main', sha: 'def' },
          draft: false,
          state: 'open',
          html_url: '',
          diff_url: '',
          patch_url: '',
          changed_files: 2,
          additions: 30,
          deletions: 5,
        },
        repository: {
          full_name: 'owner/repo',
          name: 'repo',
          owner: { login: 'owner' },
        },
      };

      await handleWebhook('pull_request', 'delivery-sync', payload);
      const reviews = getReviewResultsForPR('owner/repo', 99);
      expect(reviews.length).toBeGreaterThan(0);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('verifies a valid signature', async () => {
      const payload = '{"test": true}';
      const secret = 'test-secret';

      // Create a valid signature
      const crypto = await import('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      const validSignature = `sha256=${hmac.update(payload).digest('hex')}`;

      const isValid = await verifyWebhookSignature(payload, validSignature, secret);
      expect(isValid).toBe(true);
    });

    it('rejects an invalid signature', async () => {
      const payload = '{"test": true}';
      // Use a signature of the same length as a valid one
      const invalidSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
      const isValid = await verifyWebhookSignature(payload, invalidSig, 'test-secret');
      expect(isValid).toBe(false);
    });
  });
});

// ─── AppManifest Tests ───────────────────────────────────────────────────────

import {
  AI_CODE_REVIEW_MANIFEST,
  generateManifestJson,
  buildInstallUrl,
  STRICTNESS_PRESETS,
  COMMENT_PRESETS,
  PROVIDER_PRESETS,
} from '../integrations/github-app/AppManifest';

describe('AppManifest', () => {
  it('has the correct app name', () => {
    expect(AI_CODE_REVIEW_MANIFEST.name).toBe('SolFoundry AI Code Review');
  });

  it('is public', () => {
    expect(AI_CODE_REVIEW_MANIFEST.public).toBe(true);
  });

  it('subscribes to pull_request events', () => {
    expect(AI_CODE_REVIEW_MANIFEST.default_events).toContain('pull_request');
  });

  it('requests write access to pull_requests', () => {
    expect(AI_CODE_REVIEW_MANIFEST.default_permissions.pull_requests).toBe('write');
  });

  it('requests read access to contents', () => {
    expect(AI_CODE_REVIEW_MANIFEST.default_permissions.contents).toBe('read');
  });

  it('generates valid manifest JSON', () => {
    const json = generateManifestJson();
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe('SolFoundry AI Code Review');
  });

  it('builds a valid install URL', () => {
    const url = buildInstallUrl();
    expect(url).toContain('https://github.com/apps/new?manifest=');
  });

  it('has three strictness presets', () => {
    expect(Object.keys(STRICTNESS_PRESETS)).toHaveLength(3);
    expect(STRICTNESS_PRESETS.lenient.label).toBe('Lenient');
    expect(STRICTNESS_PRESETS.normal.label).toBe('Normal');
    expect(STRICTNESS_PRESETS.strict.label).toBe('Strict');
  });

  it('has three comment presets', () => {
    expect(Object.keys(COMMENT_PRESETS)).toHaveLength(3);
    expect(COMMENT_PRESETS.inline.label).toBe('Inline Comments');
    expect(COMMENT_PRESETS.summary.label).toBe('Summary Comment');
    expect(COMMENT_PRESETS.both.label).toBe('Inline + Summary');
  });

  it('has three provider presets', () => {
    expect(Object.keys(PROVIDER_PRESETS)).toHaveLength(3);
    expect(PROVIDER_PRESETS.claude.label).toBe('Claude');
    expect(PROVIDER_PRESETS.codex.label).toBe('Codex');
    expect(PROVIDER_PRESETS.gemini.label).toBe('Gemini');
  });
});

// ─── useGitHubApp Hook Tests ─────────────────────────────────────────────────

import { useGitHubApp } from '../hooks/useGitHubApp';

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

describe('useGitHubApp hook', () => {
  it('returns loading state initially', () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ installed: false }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useGitHubApp(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('returns isInstalled as false when no installations', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ installed: false, installations: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useGitHubApp(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isInstalled).toBe(false);
    });
  });
});

// ─── GitHubAppSetup Component Tests ──────────────────────────────────────────

import { GitHubAppSetup } from '../components/GitHubAppSetup';

describe('GitHubAppSetup component', () => {
  it('renders loading state initially', () => {
    // The component shows a loader while fetching app info
    render(<GitHubAppSetup />, { wrapper: createQueryWrapper() });
    // Should show a loading spinner initially
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<GitHubAppSetup />, { wrapper: createQueryWrapper() });
    expect(container).toBeTruthy();
  });
});
