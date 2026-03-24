/**
 * useReputation — fetches reputation data for a contributor.
 *
 * Tries GET /api/users/{username}/reputation first.
 * Falls back to computing from leaderboard data + synthetic history when
 * the dedicated endpoint is unavailable (e.g. during development).
 *
 * @module hooks/useReputation
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, isApiError } from '../services/apiClient';
import type { ReputationData, ReputationEvent, ReputationSnapshot, Tier } from '../types/reputation';

// Point weights per tier completion
const TIER_POINTS: Record<Tier, number> = { T1: 50, T2: 100, T3: 200 };

function tierFromCounts(t1: number, t2: number, t3: number): Tier {
  if (t3 > 0 || t2 >= 3 || (t1 >= 5 && t2 >= 1)) return 'T3';
  if (t1 >= 4) return 'T2';
  return 'T1';
}

/**
 * Build a plausible ReputationData from minimal leaderboard fields when
 * the dedicated API endpoint is not yet available.
 */
function buildFallback(
  bountiesCompleted: number,
  rank: number,
  totalContributors: number,
): ReputationData {
  // Spread bounties across tiers: ~50% T1, 35% T2, 15% T3
  const t1 = Math.max(0, Math.round(bountiesCompleted * 0.5));
  const t2 = Math.max(0, Math.round(bountiesCompleted * 0.35));
  const t3 = Math.max(0, bountiesCompleted - t1 - t2);
  const score = t1 * TIER_POINTS.T1 + t2 * TIER_POINTS.T2 + t3 * TIER_POINTS.T3;

  // Deterministic 12-week history
  const history: ReputationSnapshot[] = [];
  const now = new Date();
  const weeklyStep = Math.max(1, Math.floor(score / 12));
  let running = 0;
  for (let w = 11; w >= 0; w--) {
    const d = new Date(now);
    d.setDate(d.getDate() - w * 7);
    running = Math.min(score, running + weeklyStep + (w % 4 === 0 ? 15 : 0));
    history.push({ date: d.toISOString().split('T')[0], score: running });
  }
  history[history.length - 1].score = score;

  // Synthetic events, newest first
  const events: ReputationEvent[] = [];
  const tierList: Tier[] = ['T1', 'T2', 'T3'];
  for (let i = 0; i < Math.min(bountiesCompleted, 12); i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 6);
    const tier = tierList[Math.min(Math.floor(i / 5), 2)];
    events.push({
      id: `ev-${i}`,
      date: d.toISOString().split('T')[0],
      delta: TIER_POINTS[tier],
      reason: `Completed ${tier} bounty`,
      tier,
    });
  }

  return {
    score,
    rank,
    totalContributors,
    tier: tierFromCounts(t1, t2, t3),
    breakdown: {
      t1Completions: t1,
      t2Completions: t2,
      t3Completions: t3,
      avgReviewScore: 4.2,
      reviewCount: bountiesCompleted,
      streak: Math.max(1, Math.floor(bountiesCompleted / 2)),
    },
    history,
    events,
  };
}

async function fetchReputation(username: string): Promise<ReputationData> {
  // 1. Try dedicated reputation endpoint
  try {
    const data = await apiClient<ReputationData>(
      `/api/users/${encodeURIComponent(username)}/reputation`,
      { retries: 1 },
    );
    if (data && typeof data.score === 'number') return data;
  } catch (err) {
    // Rethrow hard client errors (401, 403); let 404 fall through to leaderboard
    if (isApiError(err) && err.status >= 400 && err.status < 500 && err.status !== 404) throw err;
  }

  // 2. Fall back: compute from leaderboard
  try {
    type Row = { username: string; points: number; bountiesCompleted: number };
    const rows = await apiClient<Row[]>('/api/leaderboard', {
      params: { range: 'all' },
      retries: 1,
    });
    if (Array.isArray(rows)) {
      const sorted = [...rows]
        .sort((a, b) => b.points - a.points)
        .map((c, i) => ({ ...c, rank: i + 1 }));
      const user = sorted.find(c => c.username === username);
      if (user) return buildFallback(user.bountiesCompleted, user.rank, sorted.length);
    }
  } catch { /* ignore */ }

  // 3. Ultimate fallback — empty profile
  return buildFallback(0, 0, 0);
}

export function useReputation(username: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reputation', username],
    queryFn: () => fetchReputation(username),
    staleTime: 60_000,
    enabled: Boolean(username),
  });

  return {
    reputation: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
  };
}
