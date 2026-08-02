/**
 * Format a timestamp as a human-readable relative time string.
 */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'unknown';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return 'unknown';
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 604800)}w ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a currency amount with token suffix.
 */
export function formatCurrency(amount: number | null | undefined, token?: string | null): string {
  if (amount == null) return '—';
  const formatted = amount >= 1_000_000
    ? `${(amount / 1_000_000).toFixed(1)}M`
    : amount >= 1_000
      ? `${(amount / 1_000).toFixed(1)}K`
      : amount.toLocaleString();
  return token ? `${formatted} ${token}` : formatted;
}

/**
 * Format a USD amount.
 */
export function formatUsd(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Format a FNDRY token amount.
 */
export function formatFndry(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a unique ID (for component keys, etc.).
 */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Time remaining until a deadline.
 */
export function timeLeft(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '—';
  const diff = then - now;
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor(diff / 60000);
  return `${mins}m left`;
}

/**
 * Programming language color map (for badges).
 */
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3572A5',
  Rust: '#DEA584',
  Solidity: '#363636',
  Go: '#00ADD8',
  Java: '#B07219',
  'C++': '#F34B7D',
  C: '#555555',
  HTML: '#E34F26',
  CSS: '#563D7C',
  Shell: '#89E051',
  Ruby: '#701516',
  Vue: '#4FC08D',
  React: '#61DAFB',
};
