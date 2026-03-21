import { useParams } from 'react-router-dom';
import ContributorProfile from '../components/ContributorProfile';
import { useContributor } from '../hooks/useContributor';
import { SkeletonAvatar, SkeletonText } from '../components/common/Skeleton';

export default function ContributorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: contributor, isLoading, error } = useContributor(username ?? '');

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center gap-6">
        <SkeletonAvatar size="xl" />
        <SkeletonText lines={3} className="w-full max-w-md" />
      </div>
    );
  }

  if (error || !contributor) {
    return (
      <div className="p-8 text-center text-red-400">
        Contributor not found or error loading profile.
      </div>
    );
  }

  // Map backend stats to the expected badge stats interface
  const badgeStats = {
    mergedPrCount: contributor.badge_stats?.merged_pr_count ?? contributor.stats.total_bounties_completed,
    mergedWithoutRevisionCount: contributor.badge_stats?.merged_without_revision_count ?? 0,
    isTopContributorThisMonth: contributor.badge_stats?.is_top_contributor_this_month ?? false,
    prSubmissionTimestampsUtc: contributor.badge_stats?.pr_submission_timestamps_utc ?? [],
  };

  return (
    <ContributorProfile
      username={contributor.username}
      bountiesCompleted={contributor.stats.total_bounties_completed}
      totalEarned={contributor.stats.total_earnings}
      reputationScore={contributor.stats.reputation_score}
      badgeStats={badgeStats}
    />
  );
}
