/**
 * ReputationPage — route target for /reputation/:username
 *
 * Renders the full ReputationPanel for the given contributor.
 * @module pages/ReputationPage
 */
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ReputationPanel } from '../components/reputation/ReputationPanel';

export default function ReputationPage() {
  const { username } = useParams<{ username: string }>();

  if (!username) {
    return (
      <div className="p-8 text-center text-gray-500" role="alert">
        No username specified.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 font-mono" aria-label="Breadcrumb">
        <Link
          to="/leaderboard"
          className="hover:text-gray-300 transition-colors"
        >
          Leaderboard
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          to={`/profile/${username}`}
          className="hover:text-gray-300 transition-colors"
        >
          {username}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-300">Reputation</span>
      </nav>

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {username}&apos;s Reputation
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          On-chain reputation data, tier progress, and contribution history.
        </p>
      </div>

      {/* All reputation widgets */}
      <ReputationPanel username={username} />
    </div>
  );
}
