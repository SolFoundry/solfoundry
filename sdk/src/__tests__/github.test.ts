/**
 * Tests for the GitHub API wrapper.
 *
 * Validates issue listing, claim status checking, and completion
 * verification using mocked GitHub API responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient } from '../github.js';
import { NetworkError, SolFoundryError } from '../errors.js';

describe('GitHubClient', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default owner and repo', () => {
      const client = new GitHubClient();
      expect(client).toBeDefined();
    });

    it('should accept custom config', () => {
      const client = new GitHubClient({
        token: 'ghp_test',
        owner: 'MyOrg',
        repo: 'myrepo',
      });
      expect(client).toBeDefined();
    });
  });

  describe('listBountyIssues', () => {
    it('should fetch issues with bounty label', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              number: 42,
              title: 'Bounty: Implement SDK',
              body: 'Build a TypeScript SDK...',
              state: 'open',
              labels: [{ name: 'bounty' }, { name: 'tier-2' }],
              html_url: 'https://github.com/SolFoundry/solfoundry/issues/42',
              created_at: '2026-03-01T00:00:00Z',
              updated_at: '2026-03-20T00:00:00Z',
            },
            {
              number: 43,
              title: 'Fix auth bug',
              body: 'Auth is broken',
              state: 'open',
              labels: ['bounty'],
              html_url: 'https://github.com/SolFoundry/solfoundry/issues/43',
              created_at: '2026-03-02T00:00:00Z',
              updated_at: '2026-03-21T00:00:00Z',
              pull_request: { url: 'https://api.github.com/pulls/43' },
            },
          ]),
      });

      const client = new GitHubClient({ token: 'ghp_test' });
      const issues = await client.listBountyIssues();

      // Should filter out pull_request items
      expect(issues).toHaveLength(1);
      expect(issues[0].number).toBe(42);
      expect(issues[0].title).toBe('Bounty: Implement SDK');
      expect(issues[0].labels).toEqual(['bounty', 'tier-2']);
    });

    it('should pass state and labels params', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const client = new GitHubClient();
      await client.listBountyIssues({
        state: 'closed',
        labels: 'tier-2',
        page: 2,
        perPage: 50,
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain('state=closed');
      expect(url).toContain('labels=tier-2');
      expect(url).toContain('page=2');
      expect(url).toContain('per_page=50');
    });

    it('should include auth header when token is set', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const client = new GitHubClient({ token: 'ghp_secret' });
      await client.listBountyIssues();

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers['Authorization']).toBe('Bearer ghp_secret');
    });

    it('should not include auth header without token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const client = new GitHubClient();
      await client.listBountyIssues();

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should handle string labels in issue response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              number: 1,
              title: 'Test',
              body: 'Body',
              state: 'open',
              labels: ['bounty', 'tier-1'],
              html_url: 'https://github.com/SolFoundry/solfoundry/issues/1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ]),
      });

      const client = new GitHubClient();
      const issues = await client.listBountyIssues();
      expect(issues[0].labels).toEqual(['bounty', 'tier-1']);
    });
  });

  describe('getIssue', () => {
    it('should fetch a specific issue by number', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            number: 603,
            title: 'TypeScript SDK',
            body: 'Build the core client library',
            state: 'open',
            labels: [{ name: 'bounty' }, { name: 'tier-2' }],
            html_url: 'https://github.com/SolFoundry/solfoundry/issues/603',
            created_at: '2026-03-22T00:00:00Z',
            updated_at: '2026-03-22T00:00:00Z',
          }),
      });

      const client = new GitHubClient();
      const issue = await client.getIssue(603);

      expect(issue.number).toBe(603);
      expect(issue.title).toBe('TypeScript SDK');
      expect(issue.labels).toEqual(['bounty', 'tier-2']);
    });

    it('should handle null body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            number: 1,
            title: 'No body issue',
            body: null,
            state: 'open',
            labels: [],
            html_url: 'https://github.com/SolFoundry/solfoundry/issues/1',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          }),
      });

      const client = new GitHubClient();
      const issue = await client.getIssue(1);
      expect(issue.body).toBe('');
    });
  });

  describe('listPullRequestsForIssue', () => {
    it('should search for PRs referencing an issue', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            total_count: 2,
            items: [
              {
                number: 100,
                title: 'feat: implement SDK',
                state: 'open',
                html_url: 'https://github.com/SolFoundry/solfoundry/pull/100',
                created_at: '2026-03-20T00:00:00Z',
                pull_request: {
                  merged_at: null,
                  head: { ref: 'fix/issue-42' },
                  base: { ref: 'main' },
                },
              },
              {
                number: 99,
                title: 'fix: SDK attempt 1',
                state: 'closed',
                html_url: 'https://github.com/SolFoundry/solfoundry/pull/99',
                created_at: '2026-03-18T00:00:00Z',
                pull_request: {
                  merged_at: '2026-03-19T00:00:00Z',
                  head: { ref: 'fix/issue-42-v1' },
                  base: { ref: 'main' },
                },
              },
            ],
          }),
      });

      const client = new GitHubClient();
      const prs = await client.listPullRequestsForIssue(42);

      expect(prs).toHaveLength(2);
      expect(prs[0].number).toBe(100);
      expect(prs[0].state).toBe('open');
      expect(prs[0].merged).toBe(false);
      expect(prs[1].number).toBe(99);
      expect(prs[1].state).toBe('merged');
      expect(prs[1].merged).toBe(true);
    });

    it('should filter by state when specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            total_count: 2,
            items: [
              {
                number: 100,
                title: 'Open PR',
                state: 'open',
                html_url: 'https://github.com/SolFoundry/solfoundry/pull/100',
                created_at: '2026-03-20T00:00:00Z',
                pull_request: { merged_at: null },
              },
              {
                number: 99,
                title: 'Closed PR',
                state: 'closed',
                html_url: 'https://github.com/SolFoundry/solfoundry/pull/99',
                created_at: '2026-03-18T00:00:00Z',
                pull_request: { merged_at: null },
              },
            ],
          }),
      });

      const client = new GitHubClient();
      const openPrs = await client.listPullRequestsForIssue(42, { state: 'open' });
      expect(openPrs).toHaveLength(1);
      expect(openPrs[0].number).toBe(100);
    });
  });

  describe('isIssueClaimed', () => {
    it('should return true when open PRs exist', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            total_count: 1,
            items: [
              {
                number: 100,
                title: 'PR',
                state: 'open',
                html_url: 'url',
                created_at: '2026-03-20T00:00:00Z',
                pull_request: { merged_at: null },
              },
            ],
          }),
      });

      const client = new GitHubClient();
      const claimed = await client.isIssueClaimed(42);
      expect(claimed).toBe(true);
    });

    it('should return false when no open PRs exist', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            total_count: 1,
            items: [
              {
                number: 100,
                title: 'PR',
                state: 'closed',
                html_url: 'url',
                created_at: '2026-03-20T00:00:00Z',
                pull_request: { merged_at: null },
              },
            ],
          }),
      });

      const client = new GitHubClient();
      const claimed = await client.isIssueClaimed(42);
      expect(claimed).toBe(false);
    });
  });

  describe('isIssueCompleted', () => {
    it('should return true when a merged PR exists', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            total_count: 1,
            items: [
              {
                number: 99,
                title: 'Merged PR',
                state: 'closed',
                html_url: 'url',
                created_at: '2026-03-18T00:00:00Z',
                pull_request: { merged_at: '2026-03-19T00:00:00Z' },
              },
            ],
          }),
      });

      const client = new GitHubClient();
      const completed = await client.isIssueCompleted(42);
      expect(completed).toBe(true);
    });

    it('should return false when no merged PRs exist', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            total_count: 0,
            items: [],
          }),
      });

      const client = new GitHubClient();
      const completed = await client.isIssueCompleted(42);
      expect(completed).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw SolFoundryError on GitHub API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const client = new GitHubClient();
      await expect(client.getIssue(99999)).rejects.toThrow(SolFoundryError);
    });

    it('should throw NetworkError on fetch failures', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('network down'));

      const client = new GitHubClient();
      await expect(client.listBountyIssues()).rejects.toThrow(NetworkError);
    });

    it('should handle error response where text() fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.reject(new Error('body read failed')),
      });

      const client = new GitHubClient();
      await expect(client.getIssue(1)).rejects.toThrow(SolFoundryError);
    });
  });
});
