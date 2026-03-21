/**
 * Badge — Contributor achievement badge components for SolFoundry.
 *
 * Badge types:
 *   first-bounty     🥇  "First Bounty"      bronze
 *   speed-demon      ⚡  "Speed Demon"        yellow
 *   on-fire          🔥  "On Fire"            orange
 *   diamond-hands    💎  "Diamond Hands"      purple
 *   top-contributor  🏆  "Top Contributor"    gold
 *   security-expert  🛡️  "Security Expert"   red
 *
 * Components:
 * - <BadgeList />      — horizontal row of badge chips
 * - <BadgeShowcase />  — larger display with full descriptions (profile pages)
 *
 * Locked badges are rendered greyed-out with a lock icon overlay.
 *
 * @module Badge
 */
import React from 'react';

// ─── Badge registry ───────────────────────────────────────────────────────────

export type BadgeId =
  | 'first-bounty'
  | 'speed-demon'
  | 'on-fire'
  | 'diamond-hands'
  | 'top-contributor'
  | 'security-expert';

export interface BadgeMeta {
  id: BadgeId;
  label: string;
  description: string;
  emoji: string;
  /** Tailwind colour classes: [chip bg, chip text, showcase border] */
  colors: {
    chipBg: string;
    chipText: string;
    border: string;
    iconBg: string;
    iconText: string;
  };
}

export const BADGE_REGISTRY: Record<BadgeId, BadgeMeta> = {
  'first-bounty': {
    id: 'first-bounty',
    label: 'First Bounty',
    description: 'Claimed your very first bounty on SolFoundry.',
    emoji: '🥇',
    colors: {
      chipBg: 'bg-amber-900/30',
      chipText: 'text-amber-400',
      border: 'border-amber-600/40',
      iconBg: 'bg-amber-800/40',
      iconText: 'text-amber-300',
    },
  },
  'speed-demon': {
    id: 'speed-demon',
    label: 'Speed Demon',
    description: 'Submitted a successful PR within 24 hours of a bounty being posted.',
    emoji: '⚡',
    colors: {
      chipBg: 'bg-yellow-900/30',
      chipText: 'text-yellow-400',
      border: 'border-yellow-600/40',
      iconBg: 'bg-yellow-800/40',
      iconText: 'text-yellow-300',
    },
  },
  'on-fire': {
    id: 'on-fire',
    label: 'On Fire',
    description: 'Claimed 3 or more bounties within a single week.',
    emoji: '🔥',
    colors: {
      chipBg: 'bg-orange-900/30',
      chipText: 'text-orange-400',
      border: 'border-orange-600/40',
      iconBg: 'bg-orange-800/40',
      iconText: 'text-orange-300',
    },
  },
  'diamond-hands': {
    id: 'diamond-hands',
    label: 'Diamond Hands',
    description: 'Claimed 10 or more bounties on SolFoundry.',
    emoji: '💎',
    colors: {
      chipBg: 'bg-purple-900/30',
      chipText: 'text-purple-400',
      border: 'border-purple-600/40',
      iconBg: 'bg-purple-800/40',
      iconText: 'text-purple-300',
    },
  },
  'top-contributor': {
    id: 'top-contributor',
    label: 'Top Contributor',
    description: 'Ranked in the top 10 contributors on the SolFoundry leaderboard.',
    emoji: '🏆',
    colors: {
      chipBg: 'bg-yellow-900/30',
      chipText: 'text-yellow-300',
      border: 'border-yellow-500/50',
      iconBg: 'bg-yellow-800/50',
      iconText: 'text-yellow-200',
    },
  },
  'security-expert': {
    id: 'security-expert',
    label: 'Security Expert',
    description: 'Successfully closed a security-tagged bounty.',
    emoji: '🛡️',
    colors: {
      chipBg: 'bg-red-900/30',
      chipText: 'text-red-400',
      border: 'border-red-600/40',
      iconBg: 'bg-red-800/40',
      iconText: 'text-red-300',
    },
  },
};

/** All badge IDs in display order */
export const ALL_BADGE_IDS: BadgeId[] = [
  'first-bounty',
  'speed-demon',
  'on-fire',
  'diamond-hands',
  'top-contributor',
  'security-expert',
];

// ─── Lock icon ────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-3 h-3"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ─── BadgeChip ────────────────────────────────────────────────────────────────

interface BadgeChipProps {
  badgeId: BadgeId;
  locked?: boolean;
}

function BadgeChip({ badgeId, locked = false }: BadgeChipProps) {
  const meta = BADGE_REGISTRY[badgeId];

  if (locked) {
    return (
      <span
        title={`${meta.label} — locked`}
        className="
          inline-flex items-center gap-1 px-2.5 py-1 rounded-full
          bg-gray-800/60 text-gray-600
          border border-gray-700/60
          text-xs font-medium select-none
          grayscale opacity-50
        "
      >
        <LockIcon />
        <span>{meta.label}</span>
      </span>
    );
  }

  return (
    <span
      title={meta.description}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        ${meta.colors.chipBg} ${meta.colors.chipText}
        border ${meta.colors.border}
        text-xs font-medium select-none
        transition-opacity duration-150 hover:opacity-90
      `}
    >
      <span aria-hidden="true">{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}

// ─── BadgeList ────────────────────────────────────────────────────────────────

export interface BadgeListProps {
  /** Array of earned badge IDs */
  badges: string[];
  /**
   * If true, also renders all unearned badges in a locked greyed-out state.
   * Default: false
   */
  showLocked?: boolean;
  className?: string;
}

/**
 * BadgeList — renders earned badges as horizontal chips.
 * Unearned badges can optionally be shown locked.
 */
export function BadgeList({
  badges,
  showLocked = false,
  className = '',
}: BadgeListProps) {
  const earned = new Set(badges);

  const displayIds = showLocked
    ? ALL_BADGE_IDS
    : ALL_BADGE_IDS.filter((id) => earned.has(id));

  if (displayIds.length === 0) {
    return (
      <span className={`text-xs text-gray-500 italic ${className}`}>
        No badges yet
      </span>
    );
  }

  return (
    <div
      role="list"
      aria-label="Contributor badges"
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {displayIds.map((id) => (
        <span key={id} role="listitem">
          <BadgeChip badgeId={id} locked={!earned.has(id)} />
        </span>
      ))}
    </div>
  );
}

// ─── BadgeShowcase ────────────────────────────────────────────────────────────

export interface BadgeShowcaseProps {
  /** Array of earned badge IDs */
  badges: string[];
  className?: string;
}

/**
 * BadgeShowcase — larger grid display for profile pages.
 * Shows all badges; unearned ones are greyed-out with a lock icon.
 */
export function BadgeShowcase({ badges, className = '' }: BadgeShowcaseProps) {
  const earned = new Set(badges);

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}
      aria-label="Achievement badges"
    >
      {ALL_BADGE_IDS.map((id) => {
        const meta = BADGE_REGISTRY[id];
        const isEarned = earned.has(id);

        return (
          <div
            key={id}
            className={`
              flex items-start gap-3 p-4 rounded-xl border
              transition-opacity duration-150
              ${isEarned
                ? `bg-gray-800/60 ${meta.colors.border} hover:opacity-90`
                : 'bg-gray-900/40 border-gray-800/60 opacity-40 grayscale'
              }
            `}
          >
            {/* Emoji icon block */}
            <span
              aria-hidden="true"
              className={`
                flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl
                ${isEarned ? meta.colors.iconBg : 'bg-gray-800'}
              `}
            >
              {isEarned ? meta.emoji : <LockIcon />}
            </span>

            {/* Text */}
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${
                  isEarned ? meta.colors.iconText : 'text-gray-600'
                }`}
              >
                {meta.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                {meta.description}
              </p>
              {isEarned && (
                <span className="mt-1.5 inline-block text-[10px] font-medium text-green-500 uppercase tracking-wider">
                  ✓ Earned
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BadgeList;
