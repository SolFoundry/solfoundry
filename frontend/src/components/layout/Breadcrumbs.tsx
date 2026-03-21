/**
 * Breadcrumbs - Navigation breadcrumb component
 * Automatically generates breadcrumbs from the current route
 * @module components/layout
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

// ============================================================================
// Route to Breadcrumb Mapping
// ============================================================================

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];

  // Handle root redirect
  if (segments.length === 0) {
    return breadcrumbs;
  }

  // Route mapping
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const path = '/' + segments.slice(0, i + 1).join('/');
    const isLast = i === segments.length - 1;

    let label = segment;

    // Map route segments to readable labels
    switch (segment) {
      case 'bounties':
        label = 'Bounties';
        break;
      case 'bounties-create':
      case 'create':
        label = 'Create Bounty';
        break;
      case 'leaderboard':
        label = 'Leaderboard';
        break;
      case 'agents':
        label = 'Agents';
        break;
      case 'agent':
        label = 'Agent';
        break;
      case 'tokenomics':
        label = 'Tokenomics';
        break;
      case 'how-it-works':
        label = 'How It Works';
        break;
      case 'profile':
        label = 'Profile';
        break;
      case 'dashboard':
        label = 'Dashboard';
        break;
      case 'creator':
        label = 'Creator Dashboard';
        break;
      case 'settings':
        label = 'Settings';
        break;
      default:
        // Handle dynamic IDs (numbers like bounty IDs)
        if (/^\d+$/.test(segment)) {
          label = `#${segment}`;
        } else {
          // Convert camelCase/snake_case to Title Case
          label = segment
            .replace(/[-_]/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, (c) => c.toUpperCase());
        }
        break;
    }

    breadcrumbs.push({
      label,
      href: isLast ? undefined : path,
      isCurrent: isLast,
    });
  }

  return breadcrumbs;
}

// ============================================================================
// Component
// ============================================================================

export function Breadcrumbs() {
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  // Don't show breadcrumbs on homepage
  if (location.pathname === '/' || location.pathname === '/bounties') {
    return null;
  }

  // For mobile, show only last 2 segments
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const displayBreadcrumbs = isMobile && breadcrumbs.length > 2
    ? [{ label: '...', href: undefined }, ...breadcrumbs.slice(-2)]
    : breadcrumbs;

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className="w-full px-4 sm:px-6 lg:px-8 py-3 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-white/5"
    >
      <ol className="flex items-center gap-1 sm:gap-2 text-sm overflow-x-auto">
        {displayBreadcrumbs.map((item, index) => (
          <li key={item.href || index} className="flex items-center gap-1 sm:gap-2 min-w-0">
            {/* Separator */}
            {index > 0 && (
              <span className="text-gray-600 flex-shrink-0" aria-hidden="true">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            )}

            {/* Breadcrumb Item */}
            {item.href && !item.isCurrent ? (
              <Link
                to={item.href}
                className="text-gray-400 hover:text-[#14F195] transition-colors truncate max-w-[120px] sm:max-w-none"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  item.isCurrent
                    ? 'text-[#14F195] font-medium truncate max-w-[120px] sm:max-w-none'
                    : 'text-gray-500 truncate max-w-[120px] sm:max-w-none'
                }
                aria-current={item.isCurrent ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
