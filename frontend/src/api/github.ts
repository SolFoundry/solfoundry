import { apiClient } from '../services/apiClient';

/** One GitHub contribution event type. */
export type GitHubEventType = 'push' | 'pull_request' | 'issues' | 'create' | 'delete' | 'fork' | 'watch' | 'other';

/** Normalized GitHub activity event for charting. */
export interface GitHubActivityEvent {
  date: string;       // YYYY-MM-DD
  commits: number;
  prs: number;
  issues: number;
}

/** Raw GitHub event as returned by the API. */
interface RawGitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo?: { name?: string };
  payload?: {
    size?: number;
    action?: string;
    pull_request?: unknown;
    issue?: unknown;
  };
}

function normalizeGitHubEvents(events: RawGitHubEvent[]): GitHubActivityEvent[] {
  const dayMap = new Map<string, { commits: number; prs: number; issues: number }>();

  for (const e of events) {
    const date = e.created_at?.slice(0, 10) ?? 'unknown';
    if (date === 'unknown') continue;

    if (!dayMap.has(date)) {
      dayMap.set(date, { commits: 0, prs: 0, issues: 0 });
    }
    const day = dayMap.get(date)!;

    switch (e.type) {
      case 'PushEvent':
        day.commits += e.payload?.size ?? 1;
        break;
      case 'PullRequestEvent':
        if (e.payload?.action === 'opened' || e.payload?.action === 'closed') {
          day.prs += 1;
        }
        break;
      case 'IssuesEvent':
        if (e.payload?.action === 'opened' || e.payload?.action === 'closed') {
          day.issues += 1;
        }
        break;
      case 'CreateEvent':
      case 'DeleteEvent':
      case 'ForkEvent':
        day.commits += 1; // count as minor activity
        break;
    }
  }

  // Convert to sorted array, last 90 days
  const sorted = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-90);

  return sorted.map(([date, stats]) => ({ date, ...stats }));
}

/**
 * Fetch GitHub activity for a user.
 * Uses the SolFoundry backend as a proxy to avoid CORS and rate limits.
 */
export async function getGitHubActivity(username: string): Promise<GitHubActivityEvent[]> {
  try {
    const response = await apiClient<RawGitHubEvent[] | { events: RawGitHubEvent[] }>(
      `/api/github/activity/${username}`,
      { timeoutMs: 10_000 },
    );

    const rawEvents: RawGitHubEvent[] = Array.isArray(response)
      ? response
      : response.events ?? [];

    return normalizeGitHubEvents(rawEvents);
  } catch {
    // Return empty array when API is unavailable
    return [];
  }
}

/** Aggregated GitHub contribution stats. */
export interface GitHubStats {
  totalCommits: number;
  totalPRs: number;
  totalIssues: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

/** Compute contribution streak from activity events. */
export function computeStreak(events: GitHubActivityEvent[]): { current: number; longest: number } {
  if (!events.length) return { current: 0, longest: 0 };

  let current = 0;
  let longest = 0;
  let temp = 0;

  for (const day of events) {
    const hasActivity = day.commits > 0 || day.prs > 0 || day.issues > 0;
    if (hasActivity) {
      temp++;
      if (temp > longest) longest = temp;
    } else {
      current = temp;
      temp = 0;
    }
  }
  current = temp; // streak may extend to present

  return { current, longest };
}

/** Compute GitHub stats from activity events. */
export function computeGitHubStats(events: GitHubActivityEvent[]): GitHubStats {
  const totalCommits = events.reduce((s, d) => s + d.commits, 0);
  const totalPRs = events.reduce((s, d) => s + d.prs, 0);
  const totalIssues = events.reduce((s, d) => s + d.issues, 0);
  const activeDays = events.filter(d => d.commits > 0 || d.prs > 0 || d.issues > 0).length;
  const { current, longest } = computeStreak(events);

  return { totalCommits, totalPRs, totalIssues, activeDays, currentStreak: current, longestStreak: longest };
}