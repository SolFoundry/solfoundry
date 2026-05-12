import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchGitHubActivity } from '../api/github';

const FIXED_NOW = new Date('2026-05-12T12:00:00.000Z');

function eventOnDay(offsetDays: number, type: string, commitCount?: number) {
  const d = new Date(FIXED_NOW);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return {
    id: `${type}-${offsetDays}`,
    type,
    created_at: d.toISOString(),
    payload: commitCount ? { commits: Array.from({ length: commitCount }, (_, i) => ({ sha: `sha${i}` })) } : {},
  };
}

describe('fetchGitHubActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns an empty series when username is empty', async () => {
    const result = await fetchGitHubActivity('');
    expect(result.counts.total).toBe(0);
    expect(result.daily).toHaveLength(90);
    expect(result.currentStreak).toBe(0);
  });

  it('aggregates events by type and weighs PushEvents by commit count', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        eventOnDay(0, 'PushEvent', 3),
        eventOnDay(0, 'PullRequestEvent'),
        eventOnDay(1, 'IssuesEvent'),
        eventOnDay(2, 'PullRequestReviewEvent'),
        eventOnDay(2, 'WatchEvent'), // ignored
      ],
    }).mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGitHubActivity('alice', 30);

    expect(result.counts.commits).toBe(3);
    expect(result.counts.pullRequests).toBe(1);
    expect(result.counts.issues).toBe(1);
    expect(result.counts.reviews).toBe(1);
    expect(result.counts.total).toBe(6);
    expect(result.daily).toHaveLength(30);
    expect(result.daily.at(-1)?.count).toBe(4); // today: 3 commits + 1 PR
    expect(result.daily.at(-2)?.count).toBe(1); // yesterday: 1 issue
  });

  it('computes current and longest streaks from consecutive active days', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        eventOnDay(0, 'PushEvent', 1),
        eventOnDay(1, 'PushEvent', 1),
        eventOnDay(2, 'PushEvent', 1),
        // gap on day 3
        eventOnDay(4, 'PushEvent', 1),
        eventOnDay(5, 'PushEvent', 1),
      ],
    }).mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGitHubActivity('bob', 14);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('returns zeros when the GitHub API returns a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => [] }));
    const result = await fetchGitHubActivity('ghost', 14);
    expect(result.counts.total).toBe(0);
    expect(result.daily).toHaveLength(14);
  });
});
