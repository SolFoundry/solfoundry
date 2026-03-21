import React from 'react';
import { useLocation, Link } from 'react-router-dom';

/**
 * Breadcrumbs - Navigation breadcrumb component
 * 
 * Automatically generates breadcrumbs from the current route.
 * Shows: Home > Bounties > #123 format.
 * Responsive: shows last 2 segments on mobile.
 */
export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on home page
  if (pathSegments.length === 0) {
    return null;
  }

  // Map routes to readable labels
  const getLabel = (segment: string, index: number): string => {
    // Check if it's a numeric ID (bounty, agent, etc.)
    if (/^\d+$/.test(segment)) {
      return `#${segment}`;
    }

    // Route name mappings
    const routeLabels: Record<string, string> = {
      bounties: 'Bounties',
      bounty: 'Bounty',
      leaderboard: 'Leaderboard',
      agents: 'Agents',
      agent: 'Agent',
      profile: 'Profile',
      dashboard: 'Dashboard',
      creator: 'Creator Dashboard',
      tokenomics: 'Tokenomics',
    };

    if (routeLabels[segment]) {
      return routeLabels[segment];
    }

    // For dynamic segments like usernames, show as-is
    return segment;
  };

  // Build breadcrumb paths
  const breadcrumbs = [
    { path: '/', label: 'Home' },
    ...pathSegments.map((segment, index) => ({
      path: '/' + pathSegments.slice(0, index + 1).join('/'),
      label: getLabel(segment, index),
      isLast: index === pathSegments.length - 1,
    })),
  ];

  // Mobile: show only last 2 breadcrumbs
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const displayBreadcrumbs = isMobile && breadcrumbs.length > 2
    ? [{ path: '/', label: 'Home' }, ...breadcrumbs.slice(-2)]
    : breadcrumbs;

  return (
    <nav aria-label="Breadcrumb" className="px-4 sm:px-6 lg:px-8 py-3">
      <ol className="flex items-center gap-2 text-sm">
        {displayBreadcrumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center gap-2">
            {index > 0 && (
              <span className="text-gray-500" aria-hidden="true">/</span>
            )}
            {crumb.isLast ? (
              <span className="text-gray-300 font-medium" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="text-gray-400 hover:text-[#9945FF] transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
