import { useParams } from 'react-router-dom';
import { ContributorProfileView, ContributorProfileSkeleton, ContributorNotFound } from '../components/contributor';
import { useContributorProfile, useIsNotFound } from '../hooks/useContributorProfile';

export default function ContributorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: contributor, isLoading, isError, error, refetch } = useContributorProfile(username);

  if (!username) return <ContributorNotFound />;
  if (isLoading) return <ContributorProfileSkeleton />;

  if (isError) {
    if (useIsNotFound(error)) return <ContributorNotFound />;

    const errorMessage = error instanceof Error ? error.message : 'Failed to load contributor profile';
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

  if (!contributor) return <ContributorNotFound />;

  return <ContributorProfileView contributor={contributor} />;
}
