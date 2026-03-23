/**
 * GitIdentityCard — displays a contributor's linked GitHub identity
 * with avatar, username, commit stats, and profile link.
 *
 * No external dependencies — uses only React + Tailwind.
 */
import { useState, useEffect, type ReactNode } from 'react';

interface GitIdentityProps {
  /** GitHub username */
  username: string;
  /** Avatar URL (falls back to GitHub default) */
  avatarUrl?: string;
  /** GitHub profile URL override */
  profileUrl?: string;
  /** Date the user joined the platform */
  joinDate?: string;
  /** Number of merged PRs */
  mergedPrs?: number;
  /** Total commits across bounty PRs */
  totalCommits?: number;
  /** Whether the GitHub account has been verified */
  verified?: boolean;
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

export function GitIdentityCard({
  username,
  avatarUrl,
  profileUrl,
  joinDate,
  mergedPrs = 0,
  totalCommits = 0,
  verified = false,
}: GitIdentityProps) {
  const ghUrl = profileUrl ?? `https://github.com/${username}`;
  const avatar = avatarUrl ?? `https://avatars.githubusercontent.com/${username}`;

  const formattedJoin = joinDate
    ? new Date(joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="bg-white dark:bg-surface-100 rounded-xl border border-gray-200 dark:border-white/5 p-6 shadow-sm dark:shadow-none">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <img
          src={avatar}
          alt={`${username}'s avatar`}
          className="w-14 h-14 rounded-full border-2 border-gray-200 dark:border-white/10"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {username}
            </h3>
            {verified && (
              <span
                title="Verified GitHub account"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30"
              >
                <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </div>
          <a
            href={ghUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-solana-purple hover:underline"
          >
            View GitHub Profile →
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
        <StatItem label="Merged PRs" value={mergedPrs} />
        <StatItem label="Commits" value={totalCommits} />
        <StatItem label="Joined" value={formattedJoin ?? '—'} />
      </div>
    </div>
  );
}

export default GitIdentityCard;
