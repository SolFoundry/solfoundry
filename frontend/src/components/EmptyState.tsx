/**
 * EmptyState — Centered empty / zero-data UI components for SolFoundry.
 *
 * Components:
 * - <EmptyState />              — generic, fully customisable
 * - <EmptyStateBounties />      — pre-built for the bounties list
 * - <EmptyStateContributors />  — pre-built for the contributors list
 * - <EmptyStateActivity />      — pre-built for the activity feed
 *
 * @module EmptyState
 */
import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Optional icon / illustration (React node) */
  icon?: React.ReactNode;
  /** Bold heading */
  title: string;
  /** Muted supporting message */
  message: string;
  /** Optional primary call-to-action button */
  action?: EmptyStateAction;
  /** Extra Tailwind classes on the root element */
  className?: string;
}

// ─── Default Icons ────────────────────────────────────────────────────────────

function BountiesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  );
}

function ContributorsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-12 h-12"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

/**
 * EmptyState — generic centred placeholder shown when there is no data to display.
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center
        py-16 px-6 gap-4
        ${className}
      `}
    >
      {/* Icon */}
      {icon && (
        <span className="text-gray-500 opacity-50 mb-2" aria-hidden="true">
          {icon}
        </span>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-white">{title}</h3>

      {/* Message */}
      <p className="text-sm text-gray-400 max-w-sm">{message}</p>

      {/* CTA */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="
            mt-2 px-5 py-2.5 rounded-lg
            bg-[#9945FF] hover:bg-[#9945FF]/80
            text-sm font-medium text-white
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-[#9945FF]/50
          "
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Pre-built variants ───────────────────────────────────────────────────────

export interface EmptyStateBountiesProps {
  onCreateBounty?: () => void;
  className?: string;
}

/**
 * EmptyStateBounties — shown when no bounties match the current filter.
 */
export function EmptyStateBounties({
  onCreateBounty,
  className = '',
}: EmptyStateBountiesProps) {
  return (
    <EmptyState
      icon={<BountiesIcon />}
      title="No bounties found"
      message="There are no open bounties right now. Be the first to post one and attract top contributors from the Solana ecosystem."
      action={
        onCreateBounty
          ? { label: 'Post a Bounty', onClick: onCreateBounty }
          : undefined
      }
      className={className}
    />
  );
}

export interface EmptyStateContributorsProps {
  className?: string;
}

/**
 * EmptyStateContributors — shown when a project has no contributors yet.
 */
export function EmptyStateContributors({
  className = '',
}: EmptyStateContributorsProps) {
  return (
    <EmptyState
      icon={<ContributorsIcon />}
      title="No contributors yet"
      message="No one has claimed a bounty on this project yet. Submit a PR and be the first contributor to earn $FNDRY rewards."
      className={className}
    />
  );
}

export interface EmptyStateActivityProps {
  className?: string;
}

/**
 * EmptyStateActivity — shown when the activity feed is empty.
 */
export function EmptyStateActivity({ className = '' }: EmptyStateActivityProps) {
  return (
    <EmptyState
      icon={<ActivityIcon />}
      title="No recent activity"
      message="Nothing has happened here yet. Activity appears as bounties are posted, PRs are submitted, and rewards are paid out."
      className={className}
    />
  );
}

export default EmptyState;
