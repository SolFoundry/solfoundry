/**
 * Utility functions for SolFoundry frontend.
 */

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3572A5',
  Rust: '#DEA584',
  Solidity: '#AA6746',
  Go: '#00ADD8',
  HTML: '#E34F26',
  CSS: '#1572B6',
};

/** Human-readable "time ago" string. */
export function timeAgo(timestamp: string | Date): string {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp.getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Format a number as a locale-aware currency string. */
export function formatCurrency(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Time remaining from now until a target date. */
export function getCountdownValues(target: string | Date): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const now = Date.now();
  const targetTime = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const diff = Math.max(0, targetTime - now);
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}