/**
 * Route for /profile/:username -- exact lookup via apiClient + React Query.
 * Shows contributor stats fetched from the backend, with loading skeleton
 * and proper error display on failure.
 * @module pages/ContributorProfilePage
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContributorProfile from '../components/ContributorProfile';
import { SkeletonProfile } from '../components/common/Skeleton';
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

/** Shape of the contributor API response from GET /api/contributors/:identifier. */
interface ContributorApiResponse {
  username: string;
  avatar_url?: string;
  wallet_address?: string;
  total_earned?: number;
  bounties_completed?: number;
  reputation_score?: number;
}

/**
 * Contributor profile page component.
 *
 * Fetches the contributor by username from the backend API.
 * Renders a loading skeleton while data is being fetched, a full
 * error message on failure (with retry), and the profile card on success.
 */
export default function ContributorProfilePage() {
  const { username } = useParams<{ username: string }>();

  const { data: contributor, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['contributor', username],
    queryFn: (): Promise<ContributorApiResponse> => {
      return apiClient<ContributorApiResponse>(
        `/api/contributors/${encodeURIComponent(username!)}`,
        { retries: 1 },
      );
    },
    enabled: Boolean(username),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto" role="status">
        <SkeletonProfile />
      </div>
    );
  }

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
            className="px-4 py-2 rounded-lg bg-[#9945FF]/20 text-[#9945FF] hover:bg-[#9945FF]/30 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!contributor) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center text-gray-400">
        Contributor not found.
      </div>
    );
  }

  return (
    <ContributorProfile
      username={contributor.username}
      avatarUrl={contributor.avatar_url ?? `https://avatars.githubusercontent.com/${username}`}
      walletAddress={contributor.wallet_address ?? ''}
      totalEarned={contributor.total_earned ?? 0}
      bountiesCompleted={contributor.bounties_completed ?? 0}
      reputationScore={contributor.reputation_score ?? 0}
      badgeStats={MOCK_BADGE_STATS}
    />
  );
}
