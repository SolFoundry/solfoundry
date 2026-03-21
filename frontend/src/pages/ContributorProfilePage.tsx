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
    mergedPrCount: contributor.total_bounties,
    mergedWithoutRevisionCount: Math.floor(contributor.total_bounties * 0.6), // Mock ratio for now
    isTopContributorThisMonth: contributor.reputation_score > 500,
    prSubmissionTimestampsUtc: [], // Would need a separate endpoint or enrichment
  };

  return (
    <ContributorProfile
      username={contributor.username}
      bountiesCompleted={contributor.total_bounties}
      totalEarned={contributor.total_earnings}
      reputationScore={contributor.reputation_score}
      badgeStats={badgeStats}
    />
  );
}
