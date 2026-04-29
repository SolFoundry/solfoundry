/**
 * Utility functions for SolFoundry frontend
 */

// Language colors for skill badges
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#ffac45',
  Kotlin: '#A97BFF',
  Solidity: '#363636',
  Move: '#424242',
  Solana: '#9945FF',
  React: '#61dafb',
  Vue: '#42b883',
  Node: '#339933',
  Docker: '#2496ed',
  Kubernetes: '#326ce5',
  AWS: '#ff9900',
  GCP: '#4285f4',
  Azure: '#0078d4',
};

/**
 * Format currency with token symbol
 */
export function formatCurrency(amount: number, token: string = 'FNDRY'): string {
  if (token === 'FNDRY') {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M $FNDRY`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K $FNDRY`;
    }
    return `${amount.toLocaleString()} $FNDRY`;
  }
  return `$${amount.toLocaleString()} ${token}`;
}

/**
 * Calculate time remaining until deadline
 * Returns formatted string like "3d 5h", "2h 30m", "45m", or "Expired"
 */
export function timeLeft(deadline: string | null | undefined): string {
  if (!deadline) return '';

  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get urgency level based on time remaining
 * Returns 'urgent' (< 1 hour), 'warning' (< 24 hours), or 'normal'
 */
export function getUrgencyLevel(deadline: string | null | undefined): 'urgent' | 'warning' | 'normal' {
  if (!deadline) return 'normal';

  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'urgent';
  if (diff < 1000 * 60 * 60) return 'urgent'; // < 1 hour
  if (diff < 1000 * 60 * 60 * 24) return 'warning'; // < 24 hours
  return 'normal';
}

/**
 * Format time ago (e.g., "2 hours ago", "3 days ago")
 */
export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diff = now.getTime() - date.getTime();

  if (diff < 0) return 'just now';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Format date for display (e.g., "Apr 30, 2026")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date and time for display (e.g., "Apr 30, 2026 at 2:30 PM")
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format number with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
