/**
 * Utility functions for SolFoundry frontend
 */

/**
 * Calculate time left until a deadline
 * @param deadline - ISO date string or Date object
 * @returns Human-readable time left string
 */
export function timeLeft(deadline: string | Date): string {
  const now = new Date();
  const target = new Date(deadline);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Expired';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
}

/**
 * Calculate time left in milliseconds
 * @param deadline - ISO date string or Date object
 * @returns Time left in milliseconds (0 if expired)
 */
export function timeLeftMs(deadline: string | Date): number {
  const now = new Date();
  const target = new Date(deadline);
  return Math.max(0, target.getTime() - now.getTime());
}

/**
 * Format time left as days, hours, minutes, seconds
 * @param ms - Milliseconds
 * @returns Object with days, hours, minutes, seconds
 */
export function formatTimeLeft(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

/**
 * Format a date as relative time (e.g., "2 days ago")
 * @param date - ISO date string or Date object
 * @returns Relative time string
 */
export function timeAgo(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diff = now.getTime() - target.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Format currency amount with token symbol
 * @param amount - Amount in smallest unit
 * @param token - Token symbol
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, token?: string): string {
  const symbol = token ?? 'FNDRY';
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M ${symbol}`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K ${symbol}`;
  }
  return `${amount.toLocaleString()} ${symbol}`;
}

/**
 * Language color mapping for skill badges
 */
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3776ab',
  Rust: '#dea584',
  Go: '#00add8',
  Solidity: '#363636',
  Move: '#4a90d9',
  Cairo: '#f4b53b',
  React: '#61dafb',
  'Node.js': '#339933',
  Docker: '#2496ed',
  AWS: '#ff9900',
};
