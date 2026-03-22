import { Link } from 'react-router-dom';

export function ContributorNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4 opacity-40">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Contributor Not Found</h1>
        <p className="text-gray-400 mb-6">
          The contributor you're looking for doesn't exist or hasn't joined yet.
        </p>
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-2 rounded-lg bg-solana-green/10 px-5 py-2.5 text-sm font-medium text-solana-green hover:bg-solana-green/20 transition-colors"
        >
          &larr; Back to Leaderboard
        </Link>
      </div>
    </div>
  );
}