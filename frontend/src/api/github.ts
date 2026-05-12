/**
 * GitHub public-API client used for contributor activity widgets.
 *
 * Uses the unauthenticated REST endpoints — the public `events` feed gives the
 * last ~90 days of a user's activity, which is enough to derive a daily
 * activity heatmap, current/longest streaks, and per-type counts (commits,
 * pull requests, issues).
 */

const GITHUB_API = 'https://api.github.com';

interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  payload?: {
    commits?: Array<{ sha: string }>;
    action?: string;
  };
}

export interface ActivityCounts {
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
  total: number;
}

export interface DailyActivity {
  date: string;
  count: number;
}

export interface GitHubActivity {
  username: string;
  counts: ActivityCounts;
  daily: DailyActivity[];
  currentStreak: number;
  longestStreak: number;
  rangeDays: number;
}

const DEFAULT_RANGE_DAYS = 90;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function emptyDailySeries(rangeDays: number): DailyActivity[] {
  const out: DailyActivity[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push({ date: isoDate(d), count: 0 });
  }
  return out;
}

function classifyEvent(ev: GitHubEvent): keyof ActivityCounts | null {
  switch (ev.type) {
    case 'PushEvent':
      return 'commits';
    case 'PullRequestEvent':
      return 'pullRequests';
    case 'IssuesEvent':
      return 'issues';
    case 'PullRequestReviewEvent':
    case 'PullRequestReviewCommentEvent':
      return 'reviews';
    default:
      return null;
  }
}

function eventWeight(ev: GitHubEvent): number {
  if (ev.type === 'PushEvent' && ev.payload?.commits) {
    return ev.payload.commits.length || 1;
  }
  return 1;
}

function computeStreaks(daily: DailyActivity[]): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  for (const d of daily) {
    if (d.count > 0) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  // Current streak counts back from the most recent day.
  let current = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].count > 0) current += 1;
    else break;
  }
  return { current, longest };
}

export async function fetchGitHubActivity(
  username: string,
  rangeDays: number = DEFAULT_RANGE_DAYS,
): Promise<GitHubActivity> {
  if (!username) {
    return {
      username,
      counts: { commits: 0, pullRequests: 0, issues: 0, reviews: 0, total: 0 },
      daily: emptyDailySeries(rangeDays),
      currentStreak: 0,
      longestStreak: 0,
      rangeDays,
    };
  }

  // The public events feed paginates at 30 per page, up to 3 pages.
  const pages = await Promise.all(
    [1, 2, 3].map(async (page) => {
      const res = await fetch(
        `${GITHUB_API}/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`,
        { headers: { Accept: 'application/vnd.github+json' } },
      );
      if (!res.ok) return [] as GitHubEvent[];
      return (await res.json()) as GitHubEvent[];
    }),
  );

  const events = pages.flat();
  const daily = emptyDailySeries(rangeDays);
  const dayIndex = new Map(daily.map((d, i) => [d.date, i]));
  const counts: ActivityCounts = {
    commits: 0,
    pullRequests: 0,
    issues: 0,
    reviews: 0,
    total: 0,
  };

  for (const ev of events) {
    const day = ev.created_at?.slice(0, 10);
    if (!day) continue;
    const idx = dayIndex.get(day);
    const bucket = classifyEvent(ev);
    if (bucket == null) continue;
    const weight = eventWeight(ev);
    counts[bucket] += weight;
    counts.total += weight;
    if (idx != null) daily[idx].count += weight;
  }

  const { current, longest } = computeStreaks(daily);

  return {
    username,
    counts,
    daily,
    currentStreak: current,
    longestStreak: longest,
    rangeDays,
  };
}
