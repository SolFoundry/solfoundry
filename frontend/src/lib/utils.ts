/**
 * Utility functions for the SolFoundry frontend.
 */

/** Language / skill colour map used in bounty cards. */
export const LANG_COLORS: Record<string, string> = {
  Rust: '#DEA584',
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3572A5',
  Go: '#00ADD8',
  Solidity: '#AA6746',
  Move: '#5C4B9E',
  'C++': '#F34B7D',
  Java: '#B07219',
  Ruby: '#701516',
  Solana: '#9945FF',
  Anchor: '#818CF8',
};

/**
 * Returns a human-readable string describing how far in the future (or past)
 * the given ISO date string is.
 */
export function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/**
 * Returns a human-readable "X ago" string.
 */
export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a numeric amount with a token symbol.
 */
export function formatCurrency(amount: number, token: string): string {
  return `${amount.toLocaleString()} ${token}`;
}
