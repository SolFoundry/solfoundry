/**
 * Route entry point for /profile/:username
 * Fetches contributor data and passes badge stats.
 */
import { useParams } from 'react-router-dom';
import ContributorProfile from '../components/ContributorProfile';
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

export default function ContributorProfilePage() {
  const { username } = useParams<{ username: string }>();

  return (
    <ContributorProfile
      username={username ?? ''}
      bountiesCompleted={7}
      totalEarned={15200}
      reputationScore={340}
      badgeStats={MOCK_BADGE_STATS}
    />
  );
}
