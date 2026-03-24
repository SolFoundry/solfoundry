/**
 * Route for /profile/:username and /contributor/:username — exact lookup via
 * apiClient + React Query. Shows contributor stats fetched from the backend,
 * with loading skeleton and proper error/404 display.
 * @module pages/ContributorProfilePage
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContributorProfile from '../components/ContributorProfile';
import { SkeletonContributorProfile } from '../components/common/Skeleton';
import { apiClient } from '../services/apiClient';
import type { ContributorBadgeStats } from '../types/badges';

// ── Mock badge stats (replace with real API data) ────────────────────────────
const MOCK_BADGE_STATS: ContributorBadgeStats = {
  mergedPrCount: 7,
  mergedWithoutRevisionCount: 4,
  isTopContributorThisMonth: false,
  prSubmissionTimestampsUtc: [
    '2026-03-15T02:30:00Z', // Night owl PR
    '2026-03-16T14:00:00Z',
    '2026-03-17T10:00:00Z',
    '2026-03-18T11:30:00Z',
    '2026-03-19T09:00:00Z',
    '2026-03-20T13:45:00Z',
    '2026-03-21T04:15:00Z', // Night owl PR
  ],
};

/** Shape returned by GET /api/contributors/:identifier. */
interface ContributorApiResponse {
  username: string;
  avatar_url?: string;
  wallet_address?: string;
  total_earned?: number;
  bounties_completed?: number;
  reputation_score?: number;
  created_at?: string;
  t1_completed?: number;
  t2_completed?: number;
  t3_completed?: number;
  recent_bounties?: Array<{
    title: string;
    issue_url: string;
    tier: 1 | 2 | 3;
    earned: number;
    completed_at: string;
  }>;
}

/** Derive contributor tier from bounty completion counts. */
function computeTier(t1: number, t2: number): 1 | 2 | 3 {
  if (t2 >= 2) return 3;
  if (t1 >= 4) return 2;
  return 1;
}

/** Custom error class to carry HTTP status. */
class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Contributor profile page component.
 *
 * Fetches the contributor by username from the backend API.
 * Renders a loading skeleton while data is being fetched, a styled
 * 404 card for unknown users, and the full profile card on success.
 */
export default function ContributorProfilePage() {
  const { username } = useParams<{ username: string }>();

  const { data: contributor, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['contributor', username],
    queryFn: async (): Promise<ContributorApiResponse> => {
      try {
        return await apiClient<ContributorApiResponse>(
          `/api/contributors/${encodeURIComponent(username!)}`,
          { retries: 1 },
        );
      } catch (err: unknown) {
        if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) {
          throw new ApiError('Contributor not found', 404);
        }
        throw err;
      }
    },
    enabled: Boolean(username),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto" role="status" aria-live="polite" aria-label="Loading profile">
        <SkeletonContributorProfile />
      </div>
    );
  }

  // 404 state — contributor not found
  if (isError && queryError instanceof ApiError && queryError.status === 404) {
    return (
      <div className="p-6 max-w-3xl mx-auto" data-testid="contributor-not-found">
        <div className="bg-gray-900 rounded-xl p-8 text-center space-y-4">
          <div className="text-5xl">👤</div>
          <h2 className="text-xl font-bold text-white">Contributor not found</h2>
          <p className="text-sm text-gray-400">
            No contributor with the username <span className="font-mono text-gray-300">@{username}</span> exists yet.
          </p>
          <a
            href="/leaderboard"
            className="inline-block px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm transition-colors"
          >
            View Leaderboard
          </a>
        </div>
      </div>
    );
  }

  // Generic error state
  if (isError) {
    const errorMessage = queryError instanceof Error
      ? queryError.message
      : typeof queryError === 'object' && queryError !== null && 'message' in queryError
        ? String((queryError as Record<string, unknown>).message)
        : 'An unexpected error occurred';
    return (
      <div className="p-6 max-w-3xl mx-auto" role="alert">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-semibold mb-2">Failed to load contributor profile</p>
          <p className="text-sm text-gray-400 mb-4">{errorMessage}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg bg-solana-purple/20 text-solana-purple hover:bg-solana-purple/30 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!contributor) {
    return (
      <div className="p-6 max-w-3xl mx-auto" data-testid="contributor-not-found">
        <div className="bg-gray-900 rounded-xl p-8 text-center space-y-4">
          <div className="text-5xl">👤</div>
          <h2 className="text-xl font-bold text-white">Contributor not found</h2>
          <p className="text-sm text-gray-400">
            No contributor with the username <span className="font-mono text-gray-300">@{username}</span> exists yet.
          </p>
          <a
            href="/leaderboard"
            className="inline-block px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm transition-colors"
          >
            View Leaderboard
          </a>
        </div>
      </div>
    );
  }

  const t1 = contributor.t1_completed ?? 0;
  const t2 = contributor.t2_completed ?? 0;
  const t3 = contributor.t3_completed ?? 0;
  const tier = computeTier(t1, t2);

  const recentBounties = (contributor.recent_bounties ?? []).map((b) => ({
    title: b.title,
    issueUrl: b.issue_url,
    tier: b.tier,
    earned: b.earned,
    completedAt: b.completed_at,
  }));

  return (
    <ContributorProfile
      username={contributor.username}
      avatarUrl={contributor.avatar_url ?? `https://avatars.githubusercontent.com/${username}`}
      walletAddress={contributor.wallet_address ?? ''}
      totalEarned={contributor.total_earned ?? 0}
      bountiesCompleted={contributor.bounties_completed ?? 0}
      reputationScore={contributor.reputation_score ?? 0}
      badgeStats={MOCK_BADGE_STATS}
      joinDate={contributor.created_at}
      tier={tier}
      t1Completed={t1}
      t2Completed={t2}
      t3Completed={t3}
      recentBounties={recentBounties}
    />
  );
}
