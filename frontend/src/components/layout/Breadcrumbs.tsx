import React from 'react';
import { useLocation, Link } from 'react-router-dom';

// ============================================================================
// Route label map
// ============================================================================

/**
 * Maps known path segments to human-readable labels.
 * Dynamic segments (IDs, usernames) fall back to the raw segment.
 */
const SEGMENT_LABELS: Record<string, string> = {
  bounties: 'Bounties',
  create: 'Create',
  leaderboard: 'Leaderboard',
  dashboard: 'Dashboard',
  creator: 'Creator Dashboard',
  agents: 'Agents',
  profile: 'Profile',
  settings: 'Settings',
  tokenomics: 'Tokenomics',
  'how-it-works': 'How It Works',
  contributors: 'Contributors',
};

// ============================================================================
// Helpers
// ============================================================================

interface Crumb {
  label: string;
  href: string;
  isCurrent: boolean;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Home', href: '/', isCurrent: segments.length === 0 }];

  segments.forEach((segment, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/');
    const label = SEGMENT_LABELS[segment] ?? decodeURIComponent(segment);
    crumbs.push({ label, href, isCurrent: idx === segments.length - 1 });
  });

  return crumbs;
}

/**
 * Collapse breadcrumbs on mobile: show first + last 2 segments,
 * replacing the middle with "…" if there are more than 3.
 */
function mobileCrumbs(crumbs: Crumb[]): Array<Crumb | { ellipsis: true }> {
  if (crumbs.length <= 3) return crumbs;
  return [crumbs[0], { ellipsis: true }, ...crumbs.slice(-2)];
}

// ============================================================================
// Breadcrumbs Component
// ============================================================================

export interface BreadcrumbsProps {
  className?: string;
}

/**
 * Breadcrumbs — Automatic breadcrumb navigation generated from the current route.
 *
 * - Uses React Router's useLocation()
 * - Segments map to human-readable labels via SEGMENT_LABELS
 * - All but the last segment are clickable <Link> elements
 * - Separator: "›"
 * - On mobile (< sm): shows first + last 2 segments, collapses middle with "…"
 * - No new dependencies (React Router already in use)
 */
export function Breadcrumbs({ className = '' }: BreadcrumbsProps) {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);

  // Only render when there's something beyond Home
  if (crumbs.length <= 1) return null;

  const desktopCrumbs = crumbs;
  const mobileCrumbList = mobileCrumbs(crumbs);

  return (
    <nav
      aria-label="Breadcrumb"
      className={`font-mono text-base ${className}`}
    >
      {/* Desktop: full breadcrumb list */}
      <ol className="hidden sm:flex items-center flex-wrap gap-1" role="list">
        {desktopCrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <li aria-hidden="true" className="text-gray-600 select-none">›</li>
            )}
            <li>
              {crumb.isCurrent ? (
                <span
                  className="text-gray-900 dark:text-gray-300 font-medium"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.href}
                  className="text-gray-500 transition-colors hover:text-solana-purple max-sm:inline-flex max-sm:min-h-11 max-sm:items-center max-sm:py-1"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>

      {/* Mobile: collapsed breadcrumb list */}
      <ol className="flex sm:hidden items-center flex-wrap gap-1" role="list">
        {mobileCrumbList.map((item, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <li aria-hidden="true" className="text-gray-600 select-none">›</li>
            )}
            {'ellipsis' in item ? (
              <li className="text-gray-600 select-none" aria-label="more pages">…</li>
            ) : (
              <li>
                {item.isCurrent ? (
                  <span className="text-gray-900 dark:text-gray-300 font-medium" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.href}
                    className="text-gray-500 transition-colors hover:text-solana-purple max-sm:inline-flex max-sm:min-h-11 max-sm:items-center max-sm:py-1"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            )}
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
